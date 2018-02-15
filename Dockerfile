FROM node:6.12.0-wheezy

# Create app directory
RUN mkdir -p /opt/app
WORKDIR /opt/app

# Install PM2 to keep nodejs process running in background
RUN yarn global add pm2

# Bundle app source
COPY ./ /usr/app

CMD [ "/opt/app/run.sh" ]