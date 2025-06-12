To run in dev:

```
firebase emulators:start
cd frontend && npm run dev
```

For updates to functions, you have to npm run build. It will trick you into thinking it reloaded on save but it didn't.

Setting up the cloud tasks
```
gcloud config set project tactic-toes
gcloud tasks queues create turn-expirations --location=us-central1
gcloud projects add-iam-policy-binding tactic-toes \
    --member="serviceAccount:tactic-toes@appspot.gserviceaccount.com" \
    --role="roles/datastore.user"
```