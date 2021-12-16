#!/bin/sh

kubectl create namespace "example"
kubectl create -f service_account.yaml
kubectl create clusterrolebinding ?customName?  --clusterrole=edit --serviceaccount=test:dapp-servie

