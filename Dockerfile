FROM node:18-alpine

WORKDIR /usr/src/app

COPY --chown=node:node package.json ./
COPY --chown=node:node yarn.lock ./

RUN apk add --no-cache python3 make g++ \
    # Create a symbolic link for python3 -> python
    && ln -sf python3 /usr/bin/python

RUN ls -l

RUN yarn install

COPY --chown=node:node . .

RUN ls -l

RUN mkdir -p /usr/src/app/dist \
 && chown -R node:node /usr/src/app/ \
 && chmod -R 755 /usr/src/app/

USER node

CMD ["nest", "start", "--watch"]