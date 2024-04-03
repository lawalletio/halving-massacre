# Add Power

This endpoint is used for adding power for a user that is currently alive within the game and the game is accepting power (SETUP, INITIAL or NORMAL)

```sh
curl --request GET \
  --url 'http://https/<apiendpoint>/games/<gameId>/power?amount=&walias='
```

## Method, URL and params

`GET https://<apidomain>/games/<gameId>/power?amount=<amount>&walias=<walias>`

### Path params

- `gameId`: id of the game where the power must be added, this is the nostr event id of the setup event

### Query params

- `amount`: in millisats to be added as power for the walias, must be equal or greater than the min power stipulated by the setup event
- `walias`: of the player, must already have bought a ticket and be alive in the current round

## Response body

### Success

```json
{
    "success": true,
    "pr": "<bolt11 invoice>",
    "routes": [],
    "eTag": "<string that will be published ad zapReceipt eTag>"
}
```

The success response will be a valid lud06 response with the invoice in the `pr` key

### Error

```json
{
    "success": false,
    "message": "<Error message>"
}
```

If any validation fails the response will be have a 4XX code, if the invoice generation itself failed or we encountered any unexpected error the code will be 5XX, in any case the body will contain a message.
