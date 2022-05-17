var API_KEY_BING = "Aqv51PgdNN4aM7Zz0JO77lnhWrrV2r8EwSPJjsD0jMLSqqI93NKUCcuRAr8oMdO8";                                  // Demo API Keys, please obtain your own
var API_KEY_MAPBOX = "pk.eyJ1Ijoic2VuYWdhajYxMiIsImEiOiJjbDM5MDFiZW4wMnhlM2Nwamc2YTFkMHBoIn0.IRkEekqIaZ6QtxZKAYKA5A";


var map;
const MAX_SEARCH_RESULTS = 1000;


const PLACES_INDEX_FILE = 'places/index.json';
var placesList;
var clusterPlaces;
var measureControl;

function init() {
    map = L.map('map', {zoomControl: false}).setView([51.505, -0.09], 13);            // <<< Set to London, until user authorises 'Share Location' for autolocate
   
    //Overall zoom levels
    map.options.minZoom = 7;        // Use road map from zoom levels 7-11
    map.options.maxZoom = 17;       // Os Maps available zoom levels 12-17


    // Init OS Map Layer
    var osLayer = L.tileLayer.bing(API_KEY_BING, { 
                opacity: 1, 
                zIndex: 0, 
                attribution: 'Bing Maps, OS Maps', 
                minZoom :12,            // OS Titles only available for zoom levels 12-17
                maxZoom: 17
            });
    osLayer.addTo(map);
    
    // Init Map box road layer
    var roadLayer = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=' + API_KEY_MAPBOX, {
        minZoom: 7,
        maxZoom: 11,                    // Set maxZoom to 11 for road maps, OS maps take over at zoom >= 12
        attribution: '',
        id: 'mapbox/streets-v11',
        opacity: 1,
        zIndex: 1
    });
    roadLayer.addTo(map);
    
    



    // Init locationcontrol - this will ask for permission to use location
    var s = L.control.locate({
        keepCurrentZoomLevel: true,
        locateOptions: {
            enableHighAccuracy: true
        }
    }).addTo(map);
    s.start();
 
    // Close various popups etc. if map clicked
    map.on('click', function (e) {
        document.getElementById("divSearchResults").className = "invisible";
        document.getElementById("cmdDoSearch").className = "invisible";
        document.getElementById("txtSearch").className = "invisible";

        // There are some circumstance where we don't want to show this
        showPopup(e);

    });

    // If map scrolled, or autolocate clicked, hide popup as location will have changed
    map.on('move', function (e) {
        hidePopup();
    });

    // Add measurment control
    L.control.measure({
        position: 'bottomleft',
      }).addTo(map)


    initPlacesList();
}


// Search functionality
function ToggleSearchBox() {
    if(document.getElementById("txtSearch").className == "invisible") {
        document.getElementById("txtSearch").className = "visible";
        document.getElementById("txtSearch").focus();
        document.getElementById("txtSearch").select();
        document.getElementById("cmdDoSearch").className = "visible";
        document.getElementById("divSearchResults").className = "invisible";
    } else {
        document.getElementById("txtSearch").className = "invisible";
        document.getElementById("cmdDoSearch").className = "invisible";
        document.getElementById("divSearchResults").className = "invisible";
    }




}

// Search
function DoSearch() {
    // Search will check the search string to see if it can be interpreted as:
    //   1. Ordnance Survey Grid Reference
    //   2. Longitude, Latitude
    //   3. if not, do place name gazeteer search


    var text =  document.getElementById("txtSearch").value;

    document.getElementById("cmdDoSearch").className = "invisible";
    document.getElementById("txtSearch").className = "invisible";

    if(text.trim() == "")
        return;

    text = text.trim();

    // Grid Ref  AA nn..[ ]ee..
    var regExGridRef = /^([STNHOstnho][A-Za-z]\s?)(\d{5}\s?\d{5}|\d{4}\s?\d{4}|\d{3}\s?\d{3}|\d{2}\s?\d{2}|\d{1}\s?\d{1})$/;
    var gridRef = regExGridRef.exec(text);
    if (gridRef != null) {
        SearchGridRef(gridRef);
        return;
    }

    // Lon Lat   nn.n nn.n
    var regExLatLon = /^(\-?\d+(\.\d+)?),\s*(\-?\d+(\.\d+)?)$/;
    var latLon = regExLatLon.exec(text);
    if (latLon != null) {
        SearchLatLon(latLon);
        return;
    }

    SearchGazeteer(text);
}


// Check if OSGB Grid Reference is valid, and go to location if it is
function SearchGridRef(gridRef) {
    var osgb = new GT_OSGB();
    if (osgb.parseGridRef(gridRef[0].toUpperCase())) {
        //                                          Tooltip
        GotoLocation(osgb.eastings, osgb.northings, osgb.getGridRef(5));
        return;
    }

    alert("Invalid Grid Ref");
}

// Check if Lat Lon valid, and go to location if it is
function SearchLatLon(latLon) {
    var lat = latLon[1];
    var lon = latLon[3];

    if (lat == null && lon == null) {
        alert("Invalid Lat Lon");
        return;
    }

    if (lat > 90 || lat < - 90 || lon > 180 || lon < -180) {
        alert("Invalid Lat Lon");
        return;
    }

    GotoLatLon(parseFloat(lat), parseFloat(lon), lat + '°, ' + lon + '°');
}


// Display icon at, and move to location by easting and northing. 
// Calculate Lat, Lon, then use existing GotoLatLon function
function GotoLocation(easting, northing, tooltip= 'hello !') {
    osgb = new GT_OSGB();
    osgb.setGridCoordinates(easting, northing);
    var x = osgb.getWGS84();
    GotoLatLon(x.latitude, x.longitude, tooltip);
}

// Display icon at, and move to location by Lat, Lon
function GotoLatLon(Lat, Lon, tooltip) {
    map.setView(new L.LatLng(Lat, Lon));

    var yellowMarker = new L.Icon({
        iconUrl: './images/marker-icon-2x-yellow.png',
        shadowUrl: './images/marker-shadow.png',
        popup:'test',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // Draw Marker
    marker = new L.marker([Lat, Lon], { icon: yellowMarker }).addTo(map).on('click', function(e){
        map.removeLayer(this);
    });
    marker.bindTooltip(tooltip);
    marker.on('mouseover', showHideToolTip);
}

function showHideTooltip() {
    var mytooltip = this.getTooltip();
    if(this.isPopupOpen())
        mytooltip.setOpacity(0.0);
    else
        mytooltip.setOpacity(0.9);
}


// Search gazeteer
async function SearchGazeteer(search) {
    document.getElementById("divSearchResults").className = "invisible";
    document.getElementById("tblSearchResults").className = "invisible";


    // If we've got one of our places lists selected in the dropdown, do a search on that
    // Otherwise use the Ordnance Survey gazeteer api

    if(clusterPlaces == undefined)
        SearchOSGazeteer(search);
    else
        SearchMyPlaces(search);
}

function SearchMyPlaces(search) {
    // search must create results of form array of object with same properties as OS Gazeteer search
    // [
    //   {"northing": 22323, "easting: 34332", "title": "title"}
    //   ...
    //   ...
    // ]


    // Load json for current Places List
    

    var i = document.getElementById('ddlPlaces').selectedIndex;

    if(i > 0) {             // 0 is [Select Places List]
        // Show selected Places
        var filename = placesList.files[i - 1].filename;
        var searchResults = [];
        
        // Load Places
        fetch('./places/' + filename)
            .then(response => response.json())
            .then(
                places => {
                    for(place of places.locations) {   // Iterate places and populate cluster marker
                        if(place.name.toUpperCase().includes(search.toUpperCase())) {
                            // Convert lon lat to northing and easting

                            var wgs = new GT_WGS84();
                            wgs.setDegrees(place.lat, place.lon);
                            var os = wgs.getOSGB(place.lat, place.lon);

                            // Map to searchResult object type, and add to searchResults array
                            var o = {"northing":os.northings, "easting": os.eastings, "title": place.name};
                            searchResults.push(o);
                        }
                    }

                    showResults(searchResults);

                }
            ).catch((error) => {
                console.error('Error:', error);
            }
        );
    }
}


function SearchOSGazeteer(search) {
    // Use Ordnance Survey gazeteer api to get list of places and their locations
    var url =   "https://data.ordnancesurvey.co.uk:443/datasets/50k-gazetteer/apis/search?query=" + search + "&easting=&northing=&lat=&lon=&r=1&max=" + MAX_SEARCH_RESULTS + "&offset=0&output=json";

    fetch(url, {
        // mode: 'no-cors',
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      ).then(response => {
        if (response.ok) {
          response.json().then(json => {
            showResults(json.results);
          });
        }
      });

}


// Display gazeteer search results
function showResults(results) {
    if(results.length == 0) {
        alert("Not found");
        return;
    }
    
    // If only one item returned, go to it's location
    if(results.length == 1) {
        GotoLocation(results[0].easting, results[0].northing, results[0].title);
        return;
    }

    // Clear existing table rows, and make visible
    document.getElementById("divSearchResults").className = "visible";
    document.getElementById("tblSearchResults").className = "visible";
    document.getElementById("tblSearchResults").innerHTML = "";




    // Sort results by title     results is [{"title:" "title1", etc. }, {"title:" "title2", etc. }.....   ]
    results.sort(gazResultComparer);


    // Populate each row with gazeteer entry
    for(var i = 0; i < results.length; i++)
        drawRow(results[i]);

    if(results.length >= MAX_SEARCH_RESULTS)
        addMaxCountRow();
}

// Custom compare function for gazeteer result [{"title:" "title1", etc. }, {"title:" "title2", etc. }.....   ]
function gazResultComparer(a, b) {
    if(a.title > b.title)
        return 1;
    if(a.title < b.title)
        return -1;
    return 0;
}


// Append new row to table showing a single gazeteer search result
function drawRow(rowData) {
    var row = document.getElementById("tblSearchResults").insertRow();
    var cell1 = row.insertCell();
    cell1.innerHTML = "<a href='#' style='font-size:150%;color:black' onclick='GotoLocation(" + rowData.easting + "," + rowData.northing + ",`" + rowData.title + "`);'>" + rowData.title + "</a>";


    osgb = new GT_OSGB();
    osgb.setGridCoordinates(rowData.easting, rowData.northing);    

    var cell2 = row.insertCell();
    cell2.innerHTML= "<td style='font-size:120%'>" + osgb.getGridRef(4) + "</td>";
}

// Display extra row if we've hi max matches
function addMaxCountRow() {
    var row = document.getElementById("tblSearchResults").insertRow();
    var cell1 = row.insertCell();
    cell1.innerHTML = "...only first " + MAX_SEARCH_RESULTS + " shown...";
}


// Get Location at cursor
function showPopup(e) {
    
    // We've added a _IsMeasuring variable to the Measure control, and are using it to disable popup when measuring
    // One slight snag, it's undefined before first measure, but we can't check for undefined for some reason, 
    // therefore use exception handler to catch that it's not defined and we are not in measuring mode
    var showPopup = false;
    try { 
        showPopup = !_isMeasuring;
    } catch (err) {
        showPopup = true;
    }


    if(!showPopup) {
        hidePopup();
        return;
    }

    popup.style.top =  e.originalEvent.clientY + 9 + "px";
    popup.style.left = e.originalEvent.clientX + 3 + "px";
    popup.style.zIndex  = 999;

    point.style.top =  e.originalEvent.clientY + "px";
    point.style.left = e.originalEvent.clientX + "px";
    point.style.zIndex = 1000;

    popup.style.visibility = 'visible';
    popup.style.display = 'block'
    point.style.visibility = 'visible';
    point.style.display = 'block';


    var latlng = e.latlng;
    wgs84 = new GT_WGS84();
    wgs84.setDegrees(e.latlng.lat, e.latlng.lng);

    //convert to OSGB
    osgb = wgs84.getOSGB();
    //get a grid reference with 10 digits (1 metre !!!) of precision
    gridRef = osgb.getGridRef(5);

    var sLonLat = '&nbsp;&nbsp;' + latlng + ' <img style="cursor:pointer;position:relative;top:3px" src="images/clipboard.png" title="Copy to Clipboard" onClick="copyToClipBoard(`' + e.latlng.lat + ',' + e.latlng.lng + '`)" />' + '&nbsp;&nbsp;';
    var sGridRef = '&nbsp;&nbsp;' + gridRef + ' <img style="cursor:pointer;position:relative;top:3px" src="images/clipboard.png" title="Copy to Clipboard" onClick="copyToClipBoard(`' + gridRef +'`)"/>';
    popup.innerHTML = '<span style=font-size:20px>' + sLonLat + '<br /> ' + sGridRef + '</span>';
}

function hidePopup() {
    popup.style.visibility = 'hidden';
    popup.style.display = 'none'
    point.style.visibility = 'hidden';
    point.style.display = 'none';
}

function copyToClipBoard(text) {
    // Nifty new way of coping to clipboard without having to create temprary textarea
    navigator.clipboard.writeText(text);
}




// ***** The Json stuff will only work if the website is run on a web server e.g. localhost
// ***** If it is run as a file system address, then the following will generate CORS erros (cross origin)
// ***** Therefore install a local web server

// Data Sets functionality
function initPlacesList() {
    var ddl = document.getElementById('ddlPlaces');
    

    fetch(PLACES_INDEX_FILE)
        .then(response => response.json())
        .then(
            _placesList => {
                placesList = _placesList;

                for(i of placesList.files) {   // Iterate placesList and populate dropdom ddlPlaces
                    var option = document.createElement('option');
                    option.text = i.title;
                    ddl.add(option);
                }

            }
        ).catch((error) => {
            console.error('Error:', error);
        }
    );
}

function LoadPlacesMarkers() {
    document.getElementById("divSearchResults").className = "invisible";
    document.getElementById("cmdDoSearch").className = "invisible";
    document.getElementById("txtSearch").className = "invisible";
    document.getElementById("popup").className = "invisible";



    // If first item is selected, remove markers
    // Otherwise display markers corresponding to selected places list file

    var i = document.getElementById('ddlPlaces').selectedIndex;
    
    // Remove current set of place markers if set
    if(clusterPlaces != undefined) {
        map.removeLayer(clusterPlaces);        
        clusterPlaces = undefined;
    }

    if(i > 0) {
        // Show selected Places
        var filename = placesList.files[i - 1].filename;
        clusterPlaces = new PruneClusterForLeaflet();
        clusterPlaces.Cluster.Size = 5;
 
        // Load Places
        fetch('./places/' + filename)
            .then(response => response.json())
            .then(
                places => {


                    for(place of places.locations) {   // Iterate places and populate cluster marker
                        var lon = place.lon;
                        var lat = place.lat;
                        var name = place.name;
                        var desc = place.desc;
                        
                        var marker = new PruneCluster.Marker(lat, lon);
                        marker.data.name = name;
                        
                        marker.data.popup = '<span><b>' + name + '</b><br />' + desc + '</span>';
                        //marker.data.icon = yellowIcon;                    
                        clusterPlaces.RegisterMarker(marker);
                        

                    }
                    map.addLayer(clusterPlaces);

                }
            ).catch((error) => {
                console.error('Error:', error);
            }
        );
    }



}
