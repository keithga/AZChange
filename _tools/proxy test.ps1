Invoke-webrequest -Uri "https://home.keithga.com/public/AZChange/services/AddressProxy.ashx"`
-Method "POST" -UseBasicParsing `
-Body "address=2211+West+Camelback+Road%2C+Phoenix%2C+AZ%2C+USA" -Verbose

return 

Invoke-RestMethod -UseBasicParsing -Uri "https://www.azcleanelections.gov/Custom/GetLocation" `
-Method "POST" `
-Body "address=2211+West+Camelback+Road%2C+Phoenix%2C+AZ%2C+USA&next=true" | % loc
