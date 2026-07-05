import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class DocumentReaderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for document storage
    const documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      bucketName: `document-reader-${this.account}-${this.region}`,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
      lifecycleRules: [{
        expiration: cdk.Duration.days(90),
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(30),
        }],
      }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB Table for document metadata
    const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: 'DocumentReader-Documents',
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for searching by status
    documentsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.STRING },
    });

    // GSI for searching by user
    documentsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.STRING },
    });

    // Lambda function for generating presigned URLs
    const uploadFunction = new NodejsFunction(this, 'UploadFunction', {
      entry: 'lambdas/upload.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: documentBucket.bucketName,
        TABLE_NAME: documentsTable.tableName,
      },
    });

    documentBucket.grantPut(uploadFunction);
    documentsTable.grantWriteData(uploadFunction);

    // Lambda function for processing documents with Textract
    const processFunction = new NodejsFunction(this, 'ProcessFunction', {
      entry: 'lambdas/process.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: documentBucket.bucketName,
        TABLE_NAME: documentsTable.tableName,
      },
    });

    documentBucket.grantRead(processFunction);
    documentsTable.grantReadWriteData(processFunction);
    
    // Grant Textract permissions
    processFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'textract:DetectDocumentText',
        'textract:AnalyzeDocument',
        'textract:StartDocumentAnalysis',
        'textract:GetDocumentAnalysis',
      ],
      resources: ['*'],
    }));

    // S3 trigger for processing
    documentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processFunction),
      { prefix: 'uploads/' }
    );

    // Lambda function for retrieving documents
    const getDocumentFunction = new NodejsFunction(this, 'GetDocumentFunction', {
      entry: 'lambdas/get-document.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: documentBucket.bucketName,
        TABLE_NAME: documentsTable.tableName,
      },
    });

    documentBucket.grantRead(getDocumentFunction);
    documentsTable.grantReadData(getDocumentFunction);

    // Lambda function for listing documents
    const listDocumentsFunction = new NodejsFunction(this, 'ListDocumentsFunction', {
      entry: 'lambdas/list-documents.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentsTable.tableName,
      },
    });

    documentsTable.grantReadData(listDocumentsFunction);

    // Lambda function for searching documents
    const searchFunction = new NodejsFunction(this, 'SearchFunction', {
      entry: 'lambdas/search.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: documentsTable.tableName,
      },
    });

    documentsTable.grantReadData(searchFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'DocumentReaderApi', {
      restApiName: 'Document Reader Service',
      description: 'API for document scanning and digitization',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // API Resources and Methods
    const documents = api.root.addResource('documents');
    
    // POST /documents - Get upload URL
    documents.addMethod('POST', new apigateway.LambdaIntegration(uploadFunction));
    
    // GET /documents - List documents
    documents.addMethod('GET', new apigateway.LambdaIntegration(listDocumentsFunction));
    
    // GET /documents/{id} - Get specific document
    const document = documents.addResource('{id}');
    document.addMethod('GET', new apigateway.LambdaIntegration(getDocumentFunction));
    
    // GET /documents/search - Search documents
    const search = documents.addResource('search');
    search.addMethod('GET', new apigateway.LambdaIntegration(searchFunction));

    // S3 Bucket for frontend hosting
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `document-reader-frontend-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for Document Reader Frontend',
    });

    frontendBucket.grantRead(originAccessIdentity);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'DocumentReaderApiUrl',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: documentBucket.bucketName,
      description: 'S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: documentsTable.tableName,
      description: 'DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 Bucket Name',
      exportName: 'DocumentReaderFrontendBucket',
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Frontend CloudFront URL',
      exportName: 'DocumentReaderFrontendUrl',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'DocumentReaderDistributionId',
    });
  }
}
