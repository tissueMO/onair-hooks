FROM node:18-buster

RUN apt-get update && \
    apt-get install -y ffmpeg unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -L -o aws-sam.zip https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip && \
    unzip aws-sam.zip -d /tmp/aws-sam && \
    rm aws-sam.zip && \
    /tmp/aws-sam/install && \
    sam --version

WORKDIR /app

COPY . .
RUN yarn

CMD ["yarn", "dev"]
