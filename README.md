Core Services Acceptance

When upgrading p-mysql we need to write test data and make sure that it is preserved across upgrades, etc. This small web utility makes that easy.

This app is very simple, it's basically one web page.

## Install

- `cf push --no-start`
- `cf create-service p-mysql 100mb acceptDB` (or whatever instance name you prefer)
- `cf bind-service cs-accept acceptDB`
- `cf restart cs-accept`

## Usage

Just visit the home page. For an un-initialized DB, you'll see a single entry field. As you enter keys, they'll be recorded using a timestmp as the value. From then on, every home page load will load the data set from the DB, showing that the data has been recorded in the database.

A common use-case is to deploy a version of cf-mysql or p-mysql, write a few records, then upgrade to a newer release. If the web page loads after upgrade, and the records are still there, then the data has been retained across upgrade.

### API

Write a record
- http://cs-accept.apps.pecorino.cf-app.com/write?key=MarcoNicosia

Retreive JSON of all the records
- http://cs-accept.apps.pecorino.cf-app.com/json/read?table=SampleData
