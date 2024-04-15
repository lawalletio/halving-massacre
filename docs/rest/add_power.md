# Add Power

This endpoint is used for adding power for a user that is currently alive within the game and the game is accepting power (`SETUP`, `CLOSED`, `INITIAL`, or `NORMAL` state).

```sh
curl --request GET --url 'http://https/<apiendpoint>/games/<gameId>/power?amount=<amount_of_millisats>&walias=<walias>&message=<message>'
```

## Method, URL, and Params

`GET https://<apidomain>/games/<gameId>/power?amount=<amount_of_millisats>&walias=<walias>&message=<message>`

### Path params

- `gameId`: id of the game where the power must be added, this is the nostr event id of the setup event

### Query params

- `amount_of_millisats`: millisats to be added as power for the `walias`, must be equal to or greater than the minimum power stipulated by the setup event.
- `walias`: of the player, must have already bought a ticket and be alive in the current round.
- `message`: to the player, must be less than 255 characters long.

## Response body

### Success

```json
{
  "success": true,
  "pr": "<bolt11 invoice>",
  "routes": [],
  "eTag": "<string that will be published as zapReceipt eTag>"
}
```

The success response will be a valid `lud06` response with the invoice in the `pr` key.

### Error

```json
{
  "success": false,
  "message": "<error message>"
}
```

If any validation fails the response will be have a 4xx code, if the invoice generation itself failed or we encountered any unexpected error the code will be 5xx, in any case the body will contain the error message.
