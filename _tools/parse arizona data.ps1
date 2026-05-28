<#
Generate list of candidates from Arizona Clean Elections Site.
#>

[xml]$data = type "$PSScriptROot\candidates.xml"

$x = foreach ( $Group in $data.SelectNodes("data/section") ) {

    $Branch = $null
    $Branch1 = $null
    $Branch2 = $Null
    $Branch3 = $Null

    foreach ( $item in $Group.SelectNodes("*") ) {

        $District = $Null

        if ( $item.name -eq 'h3' -and $item.HasAttribute('class') ) {
            $Branch = $item.InnerText
            Write-Warning $Branch
        }
        elseif ( $item.name -eq 'h3' ) {
            $Branch1 = $item.InnerText
            write-warning "    $Branch1"
        }
        elseif ( $Item.Name -eq 'section' ) { 

            foreach ( $Subitem in $Item.SelectNodes("*") ) {

                if ( $Subitem.Name -eq 'h3' ) {
                    $Branch2 = $Subitem.InnerText
                }
                elseif ( $Subitem.Name -eq 'h4' ) {
                    $Branch3 = $Subitem.InnerText
                }
                elseif ( $Subitem.name -eq 'ul' ) {


                    foreach ( $person in $Subitem.li ) {

                        $Office = $person.div.span[0].'#text'

                        if ( $Branch -eq 'STATE - EXECUTIVE') {
                            $District = 'state arizona'
                        }                        
                        elseif ( $person.div.span[0].'#text' -like 'U.S. House of Rep. - District *' ) {
                            $District = $Office -replace '^\D*','congress district '
                        }
                        elseif ( $person.div.span[0].'#text' -like 'State * District *' ) {
                            $District = $Office -replace '^\D*','leg district '
                        }
                        elseif ( $Branch -eq 'CITY - LEGISLATIVE' ) {
                            $District = "City $Branch1"
                        }
                        elseif ( $Branch -like 'COUNTY*' ) {
                            $District = "County $Branch1"
                        }
                        else {
                            write-warning " unknown district: $Branch $Branch1 $Branch2 $Branch3"
                        }

                        [PSCustomObject] @{

                            District = $District
                            District1 = $Branch
                            District2 = $Branch1
                            District3 = $Branch2
                            District4 = $Branch3

                            Office = $Office
                            Name = $person.div.b
                            Party = $person.div.span[1].'#text'
                            Picture = $person.img[0].src
                            Bio = "/Custom/CandidateDetail/?id=" + $person.img[1].onclick.tostring().substring(17,4)
                        }    
    
                    }                     
                }
                else {
                    write-warning "Unknown Sub Type: $($Subitem.Name)"
                }
        
            }
        }
        else {
            write-warning "Unknown Item Type: $($item.Name)"
        }
    }
}

# $x |  out-gridview
$x | Export-Csv -NoTypeInformation -Path "$PSScriptRoot\candidates.csv"

$List = foreach ( $item in $x ) {

    [ordered] @{

        District = $item.District

        Office = $item.Office
        Name = $item.Name
        Party = $item.Party

        picture = $item.Picture
        Bio = $item.Bio

        Issues = @{
            "Education" = "Lorem ipsum dolor sit amet, consectetur adipiscing elit for education voters in Arizona."
            "Healthcare" = "Lorem ipsum dolor sit amet, consectetur adipiscing elit for healthcare voters in Arizona."
            "Environment" = "Lorem ipsum dolor sit amet, consectetur adipiscing elit for environment voters in Arizona."
        }

    }
} 

$list | ConvertTo-Json -Depth 5 | Out-File -FilePath "$PSScriptRoot\candidates-Full.json" -Encoding utf8
$list | ? Party -match "(Democratic|Non-Partisan)" |  ConvertTo-Json -Depth 5 | Out-File -FilePath "$PSScriptRoot\..\data\candidates.json" -Encoding utf8