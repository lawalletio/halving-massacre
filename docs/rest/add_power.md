# Add Power

This endpoint is used for adding power for a user that is currently alive within the game and the game is accepting power (SETUP, INITIAL or NORMAL)

```sh
curl --request GET \
  --url 'http://https/<apiendpoint>/games/<gameId>/power?amount=&lud16='
```

## Method, URL and params

`GET https://<apidomain>/games/<gameId>/power?amount=<amount>&lud16=<lud16>`

### Path params

- `gameId`: id of the game where the power must be added, this is the nostr event id of the setup event

### Query params

- `amount`: in millisats to be added as power for the lud16, must be equal or greater than the min power stipulated by the setup event
- lud16: of the player, must already have bought a ticket and be alive in the current round

## Response body

### Success

```json
{
    "pr": "<bolt11 invoice>",
    "routes": []
}
```

The success response will be a valid lud06 response with the invoice in the `pr` key

### Error

```json
{
    "message": "<Error message>"
}
```

If any validation fails the response will be have a 4XX code, if the invoice generation itself failed or we encountered any unexpected error the code will be 5XX, in any case the body will contain a message.
