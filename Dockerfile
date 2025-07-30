FROM node:18-alpine
WORKDIR /usr/src/app
COPY --chown=node:node . /usr/src/app
RUN mkdir -p ./logs
RUN chown node ./logs
RUN apk add --no-cache --virtual .build-deps alpine-sdk python3 
RUN apk add --no-cache openssl

# Use --legacy-peer-deps instead of -f to bypass peer dependencies conflicts 
RUN npm install --legacy-peer-deps --ignore-scripts

RUN npm run generate:prisma

RUN apk del .build-deps
RUN npm run build:prod
USER node
EXPOSE 7400 
CMD ["npm", "run", "start:production"]
