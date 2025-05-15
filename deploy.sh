#!/bin/bash

wallet_path="/Users/weeblet/Library/Mobile Documents/com~apple~CloudDocs/WALLETS/8iD-Gy_sKx98oth27JhjjP2V_xUSIGqs_8-skb63YHg.json"
wb64=$(cat "$wallet_path" | base64)


DEPLOY_KEY="$wb64" bunx permaweb-deploy --deploy-folder ./dist --ant-process X4j36WjUIpVEknVrm4Woibz2GQn-BykiKgLoUUQ9l7o
