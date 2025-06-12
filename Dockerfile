FROM node:  24-alpine3.21

# Install PostgreSQL client and other dependencies
RUN apk add --no-cache postgresql-client python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
ENTRYPOINT ["sh", "-c", "npm run migration:run && npm run start"]