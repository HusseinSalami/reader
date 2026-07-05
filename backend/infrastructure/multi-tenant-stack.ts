import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class MultiTenantDocumentPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // 1. DynamoDB Tables - Multi-Tenant Schema
    // ========================================

    // Customers Table
    const customersTable = new dynamodb.Table(this, 'CustomersTable', {
      tableName: 'DocumentPlatform-Customers',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for email lookup
    customersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // ========================================
    // Phase 2: Unified Table for Document Types, Templates, and Documents
    // Single table design with PK/SK pattern
    // ========================================

    const documentPlatformTable = new dynamodb.Table(this, 'DocumentPlatformTable', {
      tableName: 'DocumentPlatform',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI1 for querying by document type
    documentPlatformTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // GSI2 for querying by status
    documentPlatformTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });

    // Legacy tables for backward compatibility (Phase 1)
    // These will be migrated to the unified table in future phases

    // Document Types Table (Legacy - Phase 1)
    const documentTypesTable = new dynamodb.Table(this, 'DocumentTypesTable', {
      tableName: 'DocumentPlatform-DocumentTypes',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // DOCTYPE#{documentTypeId}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Templates Table (Legacy - Phase 1)
    const templatesTable = new dynamodb.Table(this, 'TemplatesTable', {
      tableName: 'DocumentPlatform-Templates',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // TEMPLATE#{templateId}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // GSI for active templates by document type
    templatesTable.addGlobalSecondaryIndex({
      indexName: 'DocumentTypeIndex',
      partitionKey: { name: 'documentTypeId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'isActive', type: dynamodb.AttributeType.STRING },
    });

    // Documents Table - Multi-tenant with time-based sort key (Legacy - Phase 1)
    const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: 'DocumentPlatform-Documents',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // DOC#{uploadedAt}#{documentId}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for status-based queries
    documentsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'customerStatus', type: dynamodb.AttributeType.STRING }, // customerId#status
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.STRING },
    });

    // GSI for document type queries
    documentsTable.addGlobalSecondaryIndex({
      indexName: 'TypeIndex',
      partitionKey: { name: 'customerDocType', type: dynamodb.AttributeType.STRING }, // customerId#documentTypeId
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.STRING },
    });

    // Extraction Jobs Table
    const extractionJobsTable = new dynamodb.Table(this, 'ExtractionJobsTable', {
      tableName: 'DocumentPlatform-ExtractionJobs',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // JOB#{jobId}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl', // Auto-delete old jobs after 30 days
    });

    // GSI for job status queries
    extractionJobsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startedAt', type: dynamodb.AttributeType.STRING },
    });

    // Webhooks Table
    const webhooksTable = new dynamodb.Table(this, 'WebhooksTable', {
      tableName: 'DocumentPlatform-Webhooks',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // WEBHOOK#{webhookId}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // Exam Grading System Tables
    // ========================================

    // Exams Table - Stores exam questionnaires and answer keys
    const examsTable = new dynamodb.Table(this, 'ExamsTable', {
      tableName: 'DocumentPlatform-Exams',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // CUSTOMER#{customerId}
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // EXAM#{examId}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI1 for querying exams by teacher
    examsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // TEACHER#{teacherId}
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING }, // EXAM#{createdAt}
    });

    // Submissions Table - Stores student submissions and grading results
    const submissionsTable = new dynamodb.Table(this, 'SubmissionsTable', {
      tableName: 'DocumentPlatform-Submissions',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // EXAM#{examId}
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // SUBMISSION#{submissionId}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI1 for querying submissions by customer
    submissionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // CUSTOMER#{customerId}
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING }, // SUBMISSION#{submittedAt}
    });

    // GSI2 for querying submissions by student
    submissionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING }, // STUDENT#{studentId}
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING }, // SUBMISSION#{submittedAt}
    });

    // ========================================
    // 2. Cognito User Pool for Authentication
    // ========================================

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'DocumentPlatform-Users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        customerId: new cognito.StringAttribute({ mutable: false }),
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'DocumentPlatform-WebClient',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // User Pool Groups
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'ADMIN',
      description: 'Customer administrators',
    });

    new cognito.CfnUserPoolGroup(this, 'UserGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'USER',
      description: 'Regular users',
    });

    new cognito.CfnUserPoolGroup(this, 'ApiGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'API',
      description: 'API access only',
    });

    // ========================================
    // 3. S3 Bucket with Multi-Tenant Prefixes
    // ========================================

    const documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      bucketName: `document-platform-${this.account}-${this.region}`,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
      lifecycleRules: [{
        expiration: cdk.Duration.days(365),
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(90),
        }],
      }],
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // 4. SQS Queues for Processing
    // ========================================

    // Dead Letter Queue
    const dlq = new sqs.Queue(this, 'ProcessingDLQ', {
      queueName: 'DocumentPlatform-Processing-DLQ',
      retentionPeriod: cdk.Duration.days(14),
    });

    // Processing Queue
    const processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: 'DocumentPlatform-Processing',
      visibilityTimeout: cdk.Duration.minutes(15),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Webhook Delivery Queue
    const webhookQueue = new sqs.Queue(this, 'WebhookQueue', {
      queueName: 'DocumentPlatform-Webhooks',
      visibilityTimeout: cdk.Duration.minutes(5),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
    });

    // ========================================
    // 5. Lambda Functions
    // ========================================

    // Lambda Authorizer
    const authorizerFunction = new NodejsFunction(this, 'AuthorizerFunction', {
      entry: 'lambdas/auth/authorizer.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    // Customer Registration Lambda
    const registerFunction = new NodejsFunction(this, 'RegisterFunction', {
      entry: 'lambdas/customers/register.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        CUSTOMERS_TABLE: customersTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    customersTable.grantWriteData(registerFunction);
    registerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminSetUserPassword',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Login Lambda
    const loginFunction = new NodejsFunction(this, 'LoginFunction', {
      entry: 'lambdas/auth/login.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    loginFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:InitiateAuth'],
      resources: ['*'],
    }));

    // Get Customer Profile Lambda
    const getProfileFunction = new NodejsFunction(this, 'GetProfileFunction', {
      entry: 'lambdas/customers/get-profile.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CUSTOMERS_TABLE: customersTable.tableName,
      },
    });

    customersTable.grantReadData(getProfileFunction);

    // Update Customer Profile Lambda
    const updateProfileFunction = new NodejsFunction(this, 'UpdateProfileFunction', {
      entry: 'lambdas/customers/update-profile.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CUSTOMERS_TABLE: customersTable.tableName,
      },
    });

    customersTable.grantWriteData(updateProfileFunction);

    // Upload URL Lambda
    const uploadUrlFunction = new NodejsFunction(this, 'UploadUrlFunction', {
      entry: 'lambdas/documents/upload-url.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        BUCKET_NAME: documentBucket.bucketName,
        DOCUMENTS_TABLE: documentsTable.tableName,
      },
    });

    documentBucket.grantPut(uploadUrlFunction);
    documentsTable.grantWriteData(uploadUrlFunction);

    // ========================================
    // 6. API Gateway
    // ========================================

    const api = new apigateway.RestApi(this, 'DocumentPlatformApi', {
      restApiName: 'Document Platform API',
      description: 'Multi-tenant document processing platform API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      },
    });

    // Public endpoints (no auth)
    const auth = api.root.addResource('auth');
    auth.addResource('register').addMethod('POST', new apigateway.LambdaIntegration(registerFunction));
    auth.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(loginFunction));

    // Protected endpoints (require auth) - v1 API
    const v1 = api.root.addResource('v1');
    
    // Lambda Authorizer for protected endpoints
    const authorizer = new apigateway.TokenAuthorizer(this, 'ApiAuthorizer', {
      handler: authorizerFunction,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
      authorizerName: 'JwtAuthorizer',
    });
    
    // Customer endpoints
    const customers = v1.addResource('customers');
    const customersMe = customers.addResource('me');
    customersMe.addMethod('GET', new apigateway.LambdaIntegration(getProfileFunction), { authorizer });
    customersMe.addMethod('PUT', new apigateway.LambdaIntegration(updateProfileFunction), { authorizer });

    // Document endpoints
    const documents = v1.addResource('documents');
    const documentsUpload = documents.addResource('upload');
    documentsUpload.addMethod('POST', new apigateway.LambdaIntegration(uploadUrlFunction), { authorizer });

    // ========================================
    // Phase 2: Document Type Management API Endpoints
    // ========================================

    // Document Type Lambda Functions
    const createDocumentTypeFunction = new NodejsFunction(this, 'CreateDocumentTypeFunction', {
      entry: 'lambdas/document-types/create.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const listDocumentTypesFunction = new NodejsFunction(this, 'ListDocumentTypesFunction', {
      entry: 'lambdas/document-types/list.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const getDocumentTypeFunction = new NodejsFunction(this, 'GetDocumentTypeFunction', {
      entry: 'lambdas/document-types/get.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const updateDocumentTypeFunction = new NodejsFunction(this, 'UpdateDocumentTypeFunction', {
      entry: 'lambdas/document-types/update.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const deleteDocumentTypeFunction = new NodejsFunction(this, 'DeleteDocumentTypeFunction', {
      entry: 'lambdas/document-types/delete.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // Grant DynamoDB permissions to document type functions
    documentPlatformTable.grantReadWriteData(createDocumentTypeFunction);
    documentPlatformTable.grantReadData(listDocumentTypesFunction);
    documentPlatformTable.grantReadData(getDocumentTypeFunction);
    documentPlatformTable.grantReadWriteData(updateDocumentTypeFunction);
    documentPlatformTable.grantReadWriteData(deleteDocumentTypeFunction);

    // Document Type API endpoints
    const documentTypes = v1.addResource('document-types');
    
    // POST /v1/document-types - Create document type
    documentTypes.addMethod('POST', new apigateway.LambdaIntegration(createDocumentTypeFunction), { 
      authorizer,
      methodResponses: [
        { statusCode: '201' },
        { statusCode: '400' },
        { statusCode: '401' },
        { statusCode: '409' },
        { statusCode: '500' },
      ],
    });
    
    // GET /v1/document-types - List document types
    documentTypes.addMethod('GET', new apigateway.LambdaIntegration(listDocumentTypesFunction), { 
      authorizer,
      requestParameters: {
        'method.request.querystring.limit': false,
        'method.request.querystring.nextToken': false,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '500' },
      ],
    });

    // Document Type by ID endpoints
    const documentTypeById = documentTypes.addResource('{id}');
    
    // GET /v1/document-types/{id} - Get document type
    documentTypeById.addMethod('GET', new apigateway.LambdaIntegration(getDocumentTypeFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });
    
    // PUT /v1/document-types/{id} - Update document type
    documentTypeById.addMethod('PUT', new apigateway.LambdaIntegration(updateDocumentTypeFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '409' },
        { statusCode: '500' },
      ],
    });
    
    // DELETE /v1/document-types/{id} - Delete document type
    documentTypeById.addMethod('DELETE', new apigateway.LambdaIntegration(deleteDocumentTypeFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });

    // ========================================
    // Phase 2: Template Management API Endpoints
    // ========================================

    // Template Lambda Functions
    const createTemplateFunction = new NodejsFunction(this, 'CreateTemplateFunction', {
      entry: 'lambdas/templates/create.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const listTemplatesFunction = new NodejsFunction(this, 'ListTemplatesFunction', {
      entry: 'lambdas/templates/list.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const getTemplateFunction = new NodejsFunction(this, 'GetTemplateFunction', {
      entry: 'lambdas/templates/get.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const updateTemplateFunction = new NodejsFunction(this, 'UpdateTemplateFunction', {
      entry: 'lambdas/templates/update.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const deleteTemplateFunction = new NodejsFunction(this, 'DeleteTemplateFunction', {
      entry: 'lambdas/templates/delete.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // AI-Powered Template Generation Function
    const generateTemplateFunction = new NodejsFunction(this, 'GenerateTemplateFunction', {
      entry: 'lambdas/templates/generate-from-examples.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60), // Longer timeout for AI processing
      memorySize: 1024, // More memory for processing
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
        DOCUMENT_BUCKET: documentBucket.bucketName,
      },
    });

    // Grant DynamoDB permissions to template functions
    documentPlatformTable.grantReadWriteData(createTemplateFunction);
    documentPlatformTable.grantReadData(listTemplatesFunction);
    documentPlatformTable.grantReadData(getTemplateFunction);
    documentPlatformTable.grantReadWriteData(updateTemplateFunction);
    documentPlatformTable.grantReadWriteData(deleteTemplateFunction);
    documentPlatformTable.grantReadWriteData(generateTemplateFunction); // For usage tracking

    // Grant S3 permissions to generate function (to read and write sample documents)
    documentBucket.grantReadWrite(generateTemplateFunction);

    // Grant Textract permissions to generate function
    generateTemplateFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'textract:AnalyzeDocument',
      ],
      resources: ['*'],
    }));

    // Grant Bedrock permissions to generate function
    // Use wildcard for cross-region inference profiles to avoid ARN complexity
    generateTemplateFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: [
        `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        `arn:aws:bedrock:*::foundation-model/*`,
      ],
    }));

    // Template API endpoints
    const templates = v1.addResource('templates');
    
    // POST /v1/templates/generate - AI-powered template generation
    const generateEndpoint = templates.addResource('generate');
    generateEndpoint.addMethod('POST', new apigateway.LambdaIntegration(generateTemplateFunction), {
      authorizer,
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '401' },
        { statusCode: '429' }, // Rate limit exceeded
        { statusCode: '500' },
      ],
    });
    
    // POST /v1/templates - Create template
    templates.addMethod('POST', new apigateway.LambdaIntegration(createTemplateFunction), { 
      authorizer,
      methodResponses: [
        { statusCode: '201' },
        { statusCode: '400' },
        { statusCode: '401' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });
    
    // GET /v1/templates - List templates
    templates.addMethod('GET', new apigateway.LambdaIntegration(listTemplatesFunction), { 
      authorizer,
      requestParameters: {
        'method.request.querystring.documentTypeId': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.nextToken': false,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '500' },
      ],
    });

    // Template by ID endpoints
    const templateById = templates.addResource('{id}');
    
    // GET /v1/templates/{id} - Get template
    templateById.addMethod('GET', new apigateway.LambdaIntegration(getTemplateFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });
    
    // PUT /v1/templates/{id} - Update template
    templateById.addMethod('PUT', new apigateway.LambdaIntegration(updateTemplateFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });
    
    // DELETE /v1/templates/{id} - Delete template
    templateById.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTemplateFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });

    // ========================================
    // Phase 2: Document Processing API Endpoints
    // ========================================

    // Document Upload Lambda (already exists, just need to update)
    const uploadDocumentFunction = new NodejsFunction(this, 'UploadDocumentFunction', {
      entry: 'lambdas/documents/upload.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
        BUCKET_NAME: documentBucket.bucketName,
      },
    });

    // List Documents Lambda
    const listDocumentsFunction = new NodejsFunction(this, 'ListDocumentsFunction', {
      entry: 'lambdas/documents/list.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // Get Document Lambda
    const getDocumentFunction = new NodejsFunction(this, 'GetDocumentFunction', {
      entry: 'lambdas/documents/get.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // Review Document Lambda
    const reviewDocumentFunction = new NodejsFunction(this, 'ReviewDocumentFunction', {
      entry: 'lambdas/documents/review.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // Approve Document Lambda
    const approveDocumentFunction = new NodejsFunction(this, 'ApproveDocumentFunction', {
      entry: 'lambdas/documents/approve.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // Reject Document Lambda
    const rejectDocumentFunction = new NodejsFunction(this, 'RejectDocumentFunction', {
      entry: 'lambdas/documents/reject.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // Grant permissions to document functions
    documentPlatformTable.grantReadWriteData(uploadDocumentFunction);
    documentBucket.grantPut(uploadDocumentFunction);
    documentPlatformTable.grantReadData(listDocumentsFunction);
    documentPlatformTable.grantReadData(getDocumentFunction);
    documentPlatformTable.grantReadWriteData(reviewDocumentFunction);
    documentPlatformTable.grantReadWriteData(approveDocumentFunction);
    documentPlatformTable.grantReadWriteData(rejectDocumentFunction);

    // Update existing documents resource or create if needed
    // POST /v1/documents/upload - Upload document
    const documentsUploadNew = documents.addResource('upload-new');
    documentsUploadNew.addMethod('POST', new apigateway.LambdaIntegration(uploadDocumentFunction), { 
      authorizer,
      methodResponses: [
        { statusCode: '201' },
        { statusCode: '400' },
        { statusCode: '401' },
        { statusCode: '500' },
      ],
    });
    
    // GET /v1/documents - List documents
    documents.addMethod('GET', new apigateway.LambdaIntegration(listDocumentsFunction), { 
      authorizer,
      requestParameters: {
        'method.request.querystring.status': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.nextToken': false,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '500' },
      ],
    });

    // Document by ID endpoints
    const documentById = documents.addResource('{id}');
    
    // GET /v1/documents/{id} - Get document with extracted data
    documentById.addMethod('GET', new apigateway.LambdaIntegration(getDocumentFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });
    
    // PUT /v1/documents/{id}/review - Update extracted data
    const documentReview = documentById.addResource('review');
    documentReview.addMethod('PUT', new apigateway.LambdaIntegration(reviewDocumentFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });
    
    // POST /v1/documents/{id}/approve - Approve document
    const documentApprove = documentById.addResource('approve');
    documentApprove.addMethod('POST', new apigateway.LambdaIntegration(approveDocumentFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });
    
    // POST /v1/documents/{id}/reject - Reject document
    const documentReject = documentById.addResource('reject');
    documentReject.addMethod('POST', new apigateway.LambdaIntegration(rejectDocumentFunction), { 
      authorizer,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '401' },
        { statusCode: '403' },
        { statusCode: '404' },
        { statusCode: '500' },
      ],
    });

    // ========================================
    // Phase 2: Document Processing Pipeline
    // ========================================

    // Processing Lambda Functions
    const preProcessFunction = new NodejsFunction(this, 'PreProcessFunction', {
      entry: 'lambdas/processing/pre-process.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512, // Reduced since we're not doing image processing
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const invokeTextractFunction = new NodejsFunction(this, 'InvokeTextractFunction', {
      entry: 'lambdas/processing/invoke-textract.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const checkTextractStatusFunction = new NodejsFunction(this, 'CheckTextractStatusFunction', {
      entry: 'lambdas/processing/check-textract-status.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const extractFieldsFunction = new NodejsFunction(this, 'ExtractFieldsFunction', {
      entry: 'lambdas/processing/extract-fields.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const invokeBedrockFunction = new NodejsFunction(this, 'InvokeBedrockFunction', {
      entry: 'lambdas/processing/invoke-bedrock.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(2),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const validateFieldsFunction = new NodejsFunction(this, 'ValidateFieldsFunction', {
      entry: 'lambdas/processing/validate-fields.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    const storeResultsFunction = new NodejsFunction(this, 'StoreResultsFunction', {
      entry: 'lambdas/processing/store-results.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    // Grant DynamoDB permissions
    documentPlatformTable.grantReadData(extractFieldsFunction);
    documentPlatformTable.grantWriteData(storeResultsFunction);
    documentPlatformTable.grantWriteData(invokeBedrockFunction); // For usage tracking

    // Grant S3 permissions for pre-processing
    documentBucket.grantReadWrite(preProcessFunction);

    // Grant Textract permissions for pre-processing (orientation detection)
    preProcessFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'textract:DetectDocumentText',
      ],
      resources: ['*'],
    }));

    // Grant Textract permissions
    invokeTextractFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'textract:StartDocumentAnalysis',
      ],
      resources: ['*'],
    }));

    checkTextractStatusFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'textract:GetDocumentAnalysis',
      ],
      resources: ['*'],
    }));

    // Grant S3 read permissions for Textract
    documentBucket.grantRead(invokeTextractFunction);
    documentBucket.grantRead(checkTextractStatusFunction);

    // Grant Bedrock permissions
    // Use wildcard for cross-region inference profiles to avoid ARN complexity
    invokeBedrockFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: [
        `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        `arn:aws:bedrock:*::foundation-model/*`,
      ],
    }));

    // Import Step Functions module
    const sfn = require('aws-cdk-lib/aws-stepfunctions');
    const tasks = require('aws-cdk-lib/aws-stepfunctions-tasks');

    // Create Step Functions state machine
    const preProcessTask = new tasks.LambdaInvoke(this, 'PreProcessTask', {
      lambdaFunction: preProcessFunction,
      outputPath: '$.Payload',
    });

    const invokeTextractTask = new tasks.LambdaInvoke(this, 'InvokeTextractTask', {
      lambdaFunction: invokeTextractFunction,
      outputPath: '$.Payload',
    });

    const waitForTextract = new sfn.Wait(this, 'WaitForTextract', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(5)),
    });

    const checkTextractStatusTask = new tasks.LambdaInvoke(this, 'CheckTextractStatusTask', {
      lambdaFunction: checkTextractStatusFunction,
      outputPath: '$.Payload',
    });

    const extractFieldsTask = new tasks.LambdaInvoke(this, 'ExtractFieldsTask', {
      lambdaFunction: extractFieldsFunction,
      outputPath: '$.Payload',
    });

    const invokeBedrockTask = new tasks.LambdaInvoke(this, 'InvokeBedrockTask', {
      lambdaFunction: invokeBedrockFunction,
      outputPath: '$.Payload',
    });

    const validateFieldsTask = new tasks.LambdaInvoke(this, 'ValidateFieldsTask', {
      lambdaFunction: validateFieldsFunction,
      outputPath: '$.Payload',
    });

    const storeResultsTask = new tasks.LambdaInvoke(this, 'StoreResultsTask', {
      lambdaFunction: storeResultsFunction,
      outputPath: '$.Payload',
    });

    // Mark Failed Lambda - updates document status to 'failed'
    const markFailedFunction = new NodejsFunction(this, 'MarkFailedFunction', {
      entry: 'lambdas/processing/mark-failed.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentPlatformTable.tableName,
      },
    });

    documentPlatformTable.grantReadWriteData(markFailedFunction);

    const markFailedTask = new tasks.LambdaInvoke(this, 'MarkFailedTask', {
      lambdaFunction: markFailedFunction,
      outputPath: '$.Payload',
    });

    const processingComplete = new sfn.Succeed(this, 'ProcessingComplete');
    const processingFailed = new sfn.Fail(this, 'ProcessingFailed', {
      error: 'ProcessingError',
      cause: 'Document processing pipeline failed',
    });

    // Define state machine workflow
    const isTextractComplete = new sfn.Choice(this, 'IsTextractComplete')
      .when(
        sfn.Condition.stringEquals('$.textractStatus', 'SUCCEEDED'),
        extractFieldsTask
      )
      .when(
        sfn.Condition.stringEquals('$.textractStatus', 'FAILED'),
        markFailedTask
      )
      .otherwise(waitForTextract);

    const shouldUseBedrock = new sfn.Choice(this, 'ShouldUseBedrock')
      .when(
        sfn.Condition.booleanEquals('$.useBedrock', true),
        invokeBedrockTask
      )
      .otherwise(validateFieldsTask);

    // Chain the workflow with error handling
    preProcessTask.addCatch(markFailedTask, { resultPath: '$.error' });
    invokeTextractTask.addCatch(markFailedTask, { resultPath: '$.error' });
    checkTextractStatusTask.addCatch(markFailedTask, { resultPath: '$.error' });
    extractFieldsTask.addCatch(markFailedTask, { resultPath: '$.error' });
    validateFieldsTask.addCatch(markFailedTask, { resultPath: '$.error' });
    storeResultsTask.addCatch(markFailedTask, { resultPath: '$.error' });

    const definition = preProcessTask
      .next(invokeTextractTask)
      .next(waitForTextract)
      .next(checkTextractStatusTask)
      .next(isTextractComplete);

    extractFieldsTask.next(shouldUseBedrock);

    invokeBedrockTask
      .addCatch(validateFieldsTask, {
        resultPath: '$.bedrockError',
      })
      .next(validateFieldsTask);

    validateFieldsTask.next(storeResultsTask);
    storeResultsTask.next(processingComplete);

    // Mark failed task leads to final failure state
    markFailedTask.next(processingFailed);

    // Create state machine
    const processingStateMachine = new sfn.StateMachine(this, 'ProcessingStateMachine', {
      stateMachineName: 'DocumentProcessingPipeline',
      definition,
      timeout: cdk.Duration.minutes(15),
    });

    // Grant state machine permissions to invoke Lambdas
    preProcessFunction.grantInvoke(processingStateMachine);
    invokeTextractFunction.grantInvoke(processingStateMachine);
    checkTextractStatusFunction.grantInvoke(processingStateMachine);
    extractFieldsFunction.grantInvoke(processingStateMachine);
    invokeBedrockFunction.grantInvoke(processingStateMachine);
    validateFieldsFunction.grantInvoke(processingStateMachine);
    markFailedFunction.grantInvoke(processingStateMachine);
    storeResultsFunction.grantInvoke(processingStateMachine);

    // Update upload function to trigger Step Functions
    uploadDocumentFunction.addEnvironment('STATE_MACHINE_ARN', processingStateMachine.stateMachineArn);
    processingStateMachine.grantStartExecution(uploadDocumentFunction);

    // ========================================
    // Exam Grading System API Endpoints
    // ========================================

    // Shared Lambda Layer for exam grading services
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('lambdas/layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared services for exam grading system',
    });

    // Exam Management Lambda Functions
    const createExamFunction = new NodejsFunction(this, 'CreateExamFunction', {
      entry: 'lambdas/exams/create-exam.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
        BUCKET_NAME: documentBucket.bucketName,
      },
      layers: [sharedLayer],
    });

    const listExamsFunction = new NodejsFunction(this, 'ListExamsFunction', {
      entry: 'lambdas/exams/list-exams.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const getExamFunction = new NodejsFunction(this, 'GetExamFunction', {
      entry: 'lambdas/exams/get-exam.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const updateQuestionsFunction = new NodejsFunction(this, 'UpdateQuestionsFunction', {
      entry: 'lambdas/exams/update-questions.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const deleteExamFunction = new NodejsFunction(this, 'DeleteExamFunction', {
      entry: 'lambdas/exams/delete-exam.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const exportCSVFunction = new NodejsFunction(this, 'ExportCSVFunction', {
      entry: 'lambdas/exams/export-csv.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
        BUCKET_NAME: documentBucket.bucketName,
      },
      layers: [sharedLayer],
    });

    const exportExcelFunction = new NodejsFunction(this, 'ExportExcelFunction', {
      entry: 'lambdas/exams/export-excel.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
        BUCKET_NAME: documentBucket.bucketName,
      },
      layers: [sharedLayer],
    });

    // Submission Management Lambda Functions
    const uploadSubmissionFunction = new NodejsFunction(this, 'UploadSubmissionFunction', {
      entry: 'lambdas/submissions/upload-submission.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
        BUCKET_NAME: documentBucket.bucketName,
        PROCESSING_QUEUE_URL: processingQueue.queueUrl,
      },
      layers: [sharedLayer],
    });

    const batchUploadFunction = new NodejsFunction(this, 'BatchUploadFunction', {
      entry: 'lambdas/submissions/batch-upload.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
        BUCKET_NAME: documentBucket.bucketName,
        PROCESSING_QUEUE_URL: processingQueue.queueUrl,
      },
      layers: [sharedLayer],
    });

    const listSubmissionsFunction = new NodejsFunction(this, 'ListSubmissionsFunction', {
      entry: 'lambdas/submissions/list-submissions.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const getSubmissionFunction = new NodejsFunction(this, 'GetSubmissionFunction', {
      entry: 'lambdas/submissions/get-submission.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const updateGradeFunction = new NodejsFunction(this, 'UpdateGradeFunction', {
      entry: 'lambdas/submissions/update-grade.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const finalizeSubmissionFunction = new NodejsFunction(this, 'FinalizeSubmissionFunction', {
      entry: 'lambdas/submissions/finalize-submission.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
      },
      layers: [sharedLayer],
    });

    const gradeSubmissionFunction = new NodejsFunction(this, 'GradeSubmissionFunction', {
      entry: 'lambdas/processing/grade-submission.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      environment: {
        EXAMS_TABLE_NAME: examsTable.tableName,
        SUBMISSIONS_TABLE_NAME: submissionsTable.tableName,
        BUCKET_NAME: documentBucket.bucketName,
      },
      layers: [sharedLayer],
    });

    // Grant permissions
    examsTable.grantReadWriteData(createExamFunction);
    documentBucket.grantRead(createExamFunction);
    examsTable.grantReadData(listExamsFunction);
    examsTable.grantReadData(getExamFunction);
    examsTable.grantReadWriteData(updateQuestionsFunction);
    examsTable.grantReadWriteData(deleteExamFunction);
    submissionsTable.grantReadWriteData(deleteExamFunction);
    examsTable.grantReadData(exportCSVFunction);
    submissionsTable.grantReadData(exportCSVFunction);
    examsTable.grantReadData(exportExcelFunction);
    submissionsTable.grantReadData(exportExcelFunction);
    documentBucket.grantReadWrite(exportCSVFunction);
    documentBucket.grantReadWrite(exportExcelFunction);

    examsTable.grantReadData(uploadSubmissionFunction);
    submissionsTable.grantReadWriteData(uploadSubmissionFunction);
    documentBucket.grantReadWrite(uploadSubmissionFunction);
    processingQueue.grantSendMessages(uploadSubmissionFunction);

    examsTable.grantReadData(batchUploadFunction);
    submissionsTable.grantReadWriteData(batchUploadFunction);
    documentBucket.grantReadWrite(batchUploadFunction);
    processingQueue.grantSendMessages(batchUploadFunction);

    submissionsTable.grantReadData(listSubmissionsFunction);
    submissionsTable.grantReadData(getSubmissionFunction);
    submissionsTable.grantReadWriteData(updateGradeFunction);
    submissionsTable.grantReadWriteData(finalizeSubmissionFunction);

    examsTable.grantReadData(gradeSubmissionFunction);
    submissionsTable.grantReadWriteData(gradeSubmissionFunction);
    documentBucket.grantRead(gradeSubmissionFunction);

    // Grant Textract and Bedrock permissions for exam creation
    createExamFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['textract:AnalyzeDocument'],
      resources: ['*'],
    }));

    // Grant Textract and Bedrock permissions for grading
    gradeSubmissionFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['textract:*', 'bedrock:InvokeModel'],
      resources: ['*'],
    }));

    // Exam API endpoints
    const exams = v1.addResource('exams');
    
    exams.addMethod('POST', new apigateway.LambdaIntegration(createExamFunction), { authorizer });
    exams.addMethod('GET', new apigateway.LambdaIntegration(listExamsFunction), { authorizer });
    
    const examById = exams.addResource('{examId}');
    examById.addMethod('GET', new apigateway.LambdaIntegration(getExamFunction), { authorizer });
    examById.addMethod('DELETE', new apigateway.LambdaIntegration(deleteExamFunction), { authorizer });
    
    const examQuestions = examById.addResource('questions');
    examQuestions.addMethod('PUT', new apigateway.LambdaIntegration(updateQuestionsFunction), { authorizer });
    
    const examSubmissions = examById.addResource('submissions');
    examSubmissions.addMethod('POST', new apigateway.LambdaIntegration(uploadSubmissionFunction), { authorizer });
    examSubmissions.addMethod('GET', new apigateway.LambdaIntegration(listSubmissionsFunction), { authorizer });
    
    const examSubmissionsBatch = examSubmissions.addResource('batch');
    examSubmissionsBatch.addMethod('POST', new apigateway.LambdaIntegration(batchUploadFunction), { authorizer });
    
    const examExport = examById.addResource('export');
    const examExportCSV = examExport.addResource('csv');
    examExportCSV.addMethod('GET', new apigateway.LambdaIntegration(exportCSVFunction), { authorizer });
    
    const examExportExcel = examExport.addResource('excel');
    examExportExcel.addMethod('GET', new apigateway.LambdaIntegration(exportExcelFunction), { authorizer });
    
    // Submission API endpoints
    const submissions = v1.addResource('submissions');
    
    const submissionById = submissions.addResource('{submissionId}');
    submissionById.addMethod('GET', new apigateway.LambdaIntegration(getSubmissionFunction), { authorizer });
    
    const submissionGrades = submissionById.addResource('grades');
    const submissionGradeByQuestion = submissionGrades.addResource('{questionNumber}');
    submissionGradeByQuestion.addMethod('PUT', new apigateway.LambdaIntegration(updateGradeFunction), { authorizer });
    
    const submissionFinalize = submissionById.addResource('finalize');
    submissionFinalize.addMethod('POST', new apigateway.LambdaIntegration(finalizeSubmissionFunction), { authorizer });

    // ========================================
    // 7. Outputs
    // ========================================

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'DocumentPlatform-ApiUrl',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'DocumentPlatform-UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'DocumentPlatform-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'CustomersTableName', {
      value: customersTable.tableName,
      description: 'Customers DynamoDB Table',
    });

    new cdk.CfnOutput(this, 'DocumentPlatformTableName', {
      value: documentPlatformTable.tableName,
      description: 'Unified DynamoDB Table for Document Types, Templates, and Documents',
    });

    new cdk.CfnOutput(this, 'DocumentsTableName', {
      value: documentsTable.tableName,
      description: 'Documents DynamoDB Table (Legacy)',
    });

    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: documentBucket.bucketName,
      description: 'S3 Bucket for Documents',
    });

    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: processingQueue.queueUrl,
      description: 'SQS Processing Queue URL',
    });

    new cdk.CfnOutput(this, 'ProcessingStateMachineArn', {
      value: processingStateMachine.stateMachineArn,
      description: 'Step Functions State Machine ARN for Document Processing',
      exportName: 'DocumentPlatform-ProcessingStateMachineArn',
    });

    new cdk.CfnOutput(this, 'ExamsTableName', {
      value: examsTable.tableName,
      description: 'Exams DynamoDB Table for Exam Grading System',
      exportName: 'DocumentPlatform-ExamsTableName',
    });

    new cdk.CfnOutput(this, 'SubmissionsTableName', {
      value: submissionsTable.tableName,
      description: 'Submissions DynamoDB Table for Exam Grading System',
      exportName: 'DocumentPlatform-SubmissionsTableName',
    });
  }
}
