# Development
FROM ubuntu:16.04

ARG uid=1000

# Update environment
# JRE installation
RUN apt-get update -y && apt-get install -y default-jre
# Development
FROM ubuntu:16.04


# fakeroot installation
# currenlty this is failing
#RUN apt-get install -y fakeroot

# libsodium installation
#RUN apt-get install -y libsodium18


# Install curl
RUN apt-get update && apt-get install -y curl

# Install Rust
FROM rust:1.19.0
RUN cargo install

#Sovrin stuff
RUN useradd -ms /bin/bash -u $uid sovrin
USER sovrin
WORKDIR /home/sovrin
VOLUME /home/sovrin