#!/bin/sh

kubectl create namespace "example"
kubectl create -f service_account.yaml
kubectl create clusterrolebinding add-on-cluster-admin --clusterrole=cluster-admin --serviceaccount=test:dapp-servie

