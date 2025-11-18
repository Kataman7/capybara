FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy rest of the files
COPY . .

ENV NODE_ENV production

# Start in production mode by default
CMD ["npm", "start"]
