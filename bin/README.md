# Utility scripts for core-services acceptance

## load-data.pl

### Re-deploy with one big node

You'll want to change the deployment manifest to deploy a single big node, and get rid of the cluster, as replication will slow things down. Save off the original deploy manifest; then you can expand back up to 3 or 2+1 nodes afterwards, and SST should be much more efficient.

Here's the diff you should expect when changing the deployment manifest:

```
    → goprimo -d cf-mysql deploy /tmp/primo-mysql.yml
    Using environment 'bosh.primo.cf-app.com' as user 'admin'
    
    Using deployment 'cf-mysql'
    
    resource_pools:
    - name: mysql_z1
    cloud_properties:
    -     instance_type: m3.large
    +     instance_type: c4.2xlarge
    
    jobs:
    - name: mysql_z2
    -   instances: 1
    +   instances: 0
    networks:
    - name: mysql2
    static_ips:
    -     - 10.0.22.10
    - name: arbitrator_z3
    -   instances: 1
    +   instances: 0
    networks:
    - name: mysql3
    static_ips:
    -     - 10.0.23.11
    properties:
      cf_mysql:
        mysql:
          cluster_ips:
-         - 10.0.22.10
-         -
-         - 10.0.23.11
```

### Running the script

I thought I'd be clever, deploy this all onto a c4.2xlarge and write all the data loading in a single perl script, so as to avoid lots of forking of the mysql client. That was harder than I'd like, here are some notes:

1. Installing `DBD::mysql` is a pain on a bosh stemcell. Among others, you need to specify where to find the mysqld_config:
  - Become root.
    - ```cpan -fi DBD::DBI```
    - Attempt to install DBD::mysql which will fail:```cpan -fi DBD::mysql```
    - Look for the DBD::mysql directory: ```find Makefile.PL```
    - ```perl Makefile.PL --testsocket=/var/vcap/data/sys/run/mysql/mysqld.sock --testuser=root --testpassword=[REDACTED] --mysql_config=/var/vcap/data/packages/mariadb/659e865fbbfd497444cb2114adbe41890f62e1a9.1-c37afa67a1f526176097dce0315b78ffddeb7aed/bin/mysql_config```
    - I didn't get the `mysqld.sock` to work. Hence `make` works, but `make test` does not. `make install` works anyways. (I think it fails because we disallow test database.)
1. You can't use `/var/tmp` because there's not much space there. I've modified the script to use `/var/vcap/store/tmp` but you have to create that manually as root, then make it world writable.

Create or clear out the accept database:
> mysql -u root -p -e "drop database accept ; create database accept ; grant all privileges on accept.* to 'root'@'localhost'";

  - I think that last is required to enable `LOAD DATA INFILE` although I haven't gotten `LOAD DATA LOCAL INFILE` to work without changing the `my.cnf`.

I ran this in parallel using this syntax:
```
$ time DB_USER=root DB_PASSWORD=[REDACTED] nohup ~/load-data.pl 1 10000 > load-1.out 2>&1 &
...
$ time DB_USER=root DB_PASSWORD=[REDACTED] nohup ~/load-data.pl 60001 70000 > load-7.out 2>&1 &
```

You can monitor progress by:
- `tail -f load-*.out`
- `iostat -xm 1 4`
- `top`
