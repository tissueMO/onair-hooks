#!/bin/bash

cd lambda/

sam build

sam package \
  --region ap-northeast-1 \
  --s3-bucket $S3_BUCKET \
  --s3-prefix $S3_PREFIX

sam deploy \
  --region ap-northeast-1 \
  --capabilities CAPABILITY_IAM \
  --stack-name onair-hooks \
  --s3-bucket $S3_BUCKET \
  --s3-prefix $S3_PREFIX \
  --parameter-overrides \
    SubnetIds=$SUBNET_IDS \
    SecurityGroupIds=$SECURITY_GROUP_IDS \
    OpenAiApiKey=$OPENAI_API_KEY \
    RedisHost=$REDIS_HOST
