#!/bin/bash
git add --all
git commit -m "$1"
heroku config:set HEROKU_ON='True'
git pull heroku master
git push heroku master
