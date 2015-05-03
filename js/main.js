var METERS_TO_MILES = 0.000621371192;

var directionsService = new google.maps.DirectionsService();
var directionsDisplay = new google.maps.DirectionsRenderer();
var map, startLocation, endLocation, directRouteDuration;
var directionsCtr = 0;
var potentialPlaces = [];
var allProperties = [];

function midPoint(point1, point2){
  var lat1 = point1.lat();
  var lon1 = point1.lng();
  var lat2 = point2.lat();
  var lon2 = point2.lng();

  var dLon = toRad(lon2 - lon1);

  var lat1 = toRad(lat1);
  var lat2 = toRad(lat2);
  var lon1 = toRad(lon1);

  var Bx = Math.cos(lat2) * Math.cos(dLon);
  var By = Math.cos(lat2) * Math.sin(dLon);
  var lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By));
  var lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return new google.maps.LatLng(toDeg(lat3), toDeg(lon3));
}

function distanceBetween(point1, point2) 
 {
   var lat1 = point1.lat();
   var lon1 = point1.lng();
   var lat2 = point2.lat();
   var lon2 = point2.lng();
 
   var R = 6371; // km
   var dLat = toRad(lat2-lat1);
   var dLon = toRad(lon2-lon1);
   var lat1 = toRad(lat1);
   var lat2 = toRad(lat2);

   var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
     Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
   var d = R * c;
   return d;
 }

// Converts numeric degrees to radians
function toRad(val) 
{
   return val * Math.PI / 180;
}

function toDeg(val){
  return val * 180 / Math.PI;
}

function getDirections(callback){
  if(potentialPlaces.length > 0){
    var place = potentialPlaces.shift();
    var request = {
      origin: startLocation.geometry.location,
      destination: endLocation.geometry.location,
      optimizeWaypoints: true,
      unitSystem: google.maps.UnitSystem.IMPERIAL,
      travelMode: google.maps.TravelMode.DRIVING
    };
    if(place){
      request.waypoints = [{location: "" + place.la + "," + place.lo}];
    }
    directionsService.route(request, function(response, status) {
      if (status == google.maps.DirectionsStatus.OK) {
        console.log(status);
        addResult(response, place);
        if(potentialPlaces.length > 0){
          setTimeout(function(){getDirections(callback)}, 200);
        } else if (callback){
          callback(response);
        }
      } else if (status == google.maps.DirectionsStatus.OVER_QUERY_LIMIT){
        potentialPlaces.push(place);
        setTimeout(function(){getDirections(callback)}, 2000);
      }
    });
  } else if (callback){
    callback(); 
  }
}

function addResult(directions, place){
  var route = directions.routes[0];
  
  var duration = route.legs[0].duration.value;
  var distance = route.legs[0].distance.value;
  var legRatio = 1;
  
  if(place){
    duration += route.legs[1].duration.value;
    distance += route.legs[1].distance.value;
    legRatio = route.legs[0].duration.value / route.legs[1].duration.value;
    if(legRatio > 1){
      legRatio = 1 / legRatio;
    }
  }

  var resultText = '';
  var durationDiff = 0;
  if(place){
    durationDiff = Math.round((duration - directRouteDuration) / 60);
    resultText += "<strong>" + place.name + "</strong><br>";
    resultText += durationDiff + " minutes longer"
  } else {
    resultText += "<strong>" + "Direct route" + "</strong><br>";
    resultText += Math.round(duration / 60) + " minutes"
    directRouteDuration = duration;
  }
  
  resultText += " " + legRatio;
  // resultText  += " (" + Math.round(distance * METERS_TO_MILES) + " miles)";
  var result = $("<li class='list-group-item'>" + resultText + "</li>");
  result.data('leg-ratio', legRatio);
  result.data('duration',duration);
  result.on('click', function(){
    directionsDisplay.setDirections(directions);
  });
  
  if(place && (durationDiff <= 60) && (legRatio > 0.5)){
    var marker = new google.maps.Marker({
         position: new google.maps.LatLng(place.la, place.lo),
         map: map,
         title: place.name
     });
     $('#results').append(result);
   }

  // Sort by extra duration
  // $('#results').find("li").detach().sort(function(a, b) {
  //   return($(a).data('duration') - $(b).data('duration'));
  // }).each(function(index, el) {
  //   $('#results').append(el);
  // });
  
  // Sort by leg ratio
  $('#results').find("li").detach().sort(function(a, b) {
    return($(b).data('leg-ratio') - $(a).data('leg-ratio'));
  }).each(function(index, el) {
    $('#results').append(el);
  });
}

function initialize() {
  var mapOptions = {
    center: new google.maps.LatLng(54.96175206818404,-4.454484374999992),
    zoom: 5
  };
  map = new google.maps.Map(document.getElementById('map-canvas'),
  mapOptions);
  directionsDisplay.setMap(map);
    
  // Start input
  var startInput = document.getElementById('start-input');
  var autocompleteStart = new google.maps.places.Autocomplete(startInput);
  autocompleteStart.bindTo('bounds', map);
  google.maps.event.addListener(autocompleteStart, 'place_changed', function() {
    startLocation = autocompleteStart.getPlace();
  });
    
  // End input
  var endInput = document.getElementById('end-input');
  var autocompleteEnd = new google.maps.places.Autocomplete(endInput);
  autocompleteEnd.bindTo('bounds', map);
  google.maps.event.addListener(autocompleteEnd, 'place_changed', function() {
    endLocation = autocompleteEnd.getPlace();
  });
  
  $.getJSON('./data/all.json', function(data){
    allProperties = data;
  })
  
  $('.search-form a').click(function(e){
    e.preventDefault();
    if (startLocation && endLocation){
      $('#results').html('');
      potentialPlaces = [null];
      // Get most direct route without stopping
      getDirections(function(directDirections){
        directionsDisplay.setDirections(directDirections);
        var mid = midPoint(startLocation.geometry.location, endLocation.geometry.location);
        var radius = distanceBetween(startLocation.geometry.location, mid);
        allProperties.results.forEach(function(place){
          var latLng = new google.maps.LatLng(place.la, place.lo);
          var dist = distanceBetween(latLng, mid);
          if (dist < radius){
            potentialPlaces.push(place);
          }
        });
        getDirections();
      })
    }
  });
}

google.maps.event.addDomListener(window, 'load', initialize);