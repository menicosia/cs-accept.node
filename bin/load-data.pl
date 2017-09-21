#!/usr/bin/perl -w

# Create a bunch of random data files, indexed by range, then load them into a MySQL DB
#
# Usage: load.data.pl rangeStart rangeEnd
#
# Requirements:
#  Always assumes a pre-existing database called "accept", writable by the creds provided
#  Always assumes a pre-existing directory "/var/vcap/store/tmp" ## FIXME: Configurable TMPDIR?
#  Needs DB_USER and DB_PASSWORD environment variables
#
# NOTE: If you just need a lot of data, that's OK with repeated random data, just
#       seed your data with this script, then run this a few times:
#       insert into randomdataX select NULL,text from randomdataX LIMIT 1000000;

$| = 1 ;
use DBI ;

$dbUser = $ENV{'DB_USER'} ;
$dbPassword = $ENV{'DB_PASSWORD'} ;

sub writeRandomData {
    my ($filename, $numRecords) = @_ ;
    my ($i, $j, $q) ;

    open(DATA,">",$filename) || die ;
    for ($i = 0 ; $i < $numRecords ; $i++) {
        $j = int(rand(10000)) ;
        $q = int(rand(10000)) ;
        print DATA "$j,$q\n" ;
    }
    close(DATA) ;

    return 1 ;
}

sub createDataSet {
    my $range = shift(@_) ;
    my $a ;

    for ($a = $range->{"start"} ; $a <= $range->{"end"} ; $a++) {
        if (! int($a % 1000)) { print " ... writing datafiles $a" }
        writeRandomData("/var/tmp/randomdata$a.csv", 10000) ;
    }
    print "\nwriting datafiles done: ", $a-1, "\n" ;
}

sub importDataSet {
    my $range = shift(@_) ;
    my $x ;
    my $dbh = DBI->connect("DBI:mysql:database=accept;host=localhost", $dbUser, $dbPassword) ;
    
    for ($x = $range->{"start"} ; $x <= $range->{"end"} ; $x++) {
        if (! int($x % 1000)) { print " ... loaded $x" }
        $dbh->do("SET FOREIGN_KEY_CHECKS = 0") ;
        $dbh->do("SET UNIQUE_CHECKS = 0") ;
        $dbh->do("SET SESSION tx_isolation='READ-UNCOMMITTED'") ;
        $dbh->do("SET sql_log_bin = 0") ;
        $dbh->do("CREATE TABLE randomdata$x (col1 INT, col2 INT)") ;
        $dbh->do("LOAD DATA LOCAL INFILE '/var/tmp/randomdata$x.csv' IGNORE INTO TABLE randomdata$x fields terminated by ','") ;
    }
    $dbh->disconnect() ;
    print "\nloading done: ", $x-1, "\n" ;
}

### MAIN

if (! -d "/var/vcap/store/tmp") {
    die "[ERROR] missing required /var/vcap/store/tmp directory" ;
}

if (1 > $#ARGV) {
    die "[ERROR] Missing command line arguments Start and End of range" ;
} else {
    %range = ( "start" => $ARGV[0], "end" => $ARGV[1] ) ;
}

&createDataSet(\%range) ;
&importDataSet(\%range) ;

exit 0 ;
