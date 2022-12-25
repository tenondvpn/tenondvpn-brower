ps -ef | grep node | awk -F' ' '{print $2}' | xargs kill -9
rm -rf /root/.forever/dvpn.log
tm=`date +%s`
echo $tm
forever start -l dvpn.log -o out."$tm".log -e err."$tm".log ./bin/www
