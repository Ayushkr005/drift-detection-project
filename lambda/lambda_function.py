def lambda_handler(event, context):
    print("Drift detected!")
    return {"status": "ok"}