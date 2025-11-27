FROM node:20-alpine

WORKDIR /usr/src/app

# Accept a build-time argument so the image contains the commit used to build it.
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ENV COMMIT_HASH=${GIT_COMMIT}
ENV BRANCH_NAME=${GIT_BRANCH}

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy rest of the files
COPY . .

# Write a COMMIT file so the runtime (inside Docker) can read the short commit hash
RUN echo ${COMMIT_HASH} > /usr/src/app/COMMIT || true
RUN echo ${BRANCH_NAME} > /usr/src/app/BRANCH || true

ENV NODE_ENV production

# Start in production mode by default
CMD ["npm", "start"]
