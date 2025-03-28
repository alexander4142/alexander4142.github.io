let gpxData = null;
let xmlDoc = null;

document.getElementById("gpxFile").addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        gpxData = parseGPX(text);
    };
    reader.readAsText(file);
});

document.getElementById("enter").addEventListener("click", function() {
    const newDuration = hhmmssToSeconds(document.getElementById("targetBox").value);
    const oldDuration = (gpxData["times"][gpxData["times"].length-1] - gpxData["times"][0]) / 1000;
    const ratio = oldDuration / newDuration;
    const gap = 1;
    const clock = gpxData["times"][0];

    // Create splines
    const splineLat = numeric.spline(gpxData["times"], gpxData["lats"], 0, 0);
    const splineLong = numeric.spline(gpxData["times"], gpxData["longs"], 0, 0);
    const splineElevation = numeric.spline(gpxData["times"], gpxData["elevations"], 0, 0);
    const splineHeartRate = gpxData["heartRates"].length > 0 ? numeric.spline(gpxData["times"], gpxData["heartRates"], 0, 0) : null;
    const splineCadence = gpxData["cadences"].length > 0 ? numeric.spline(gpxData["times"], gpxData["cadences"], 0, 0) : null;

    segment = xmlDoc.getElementsByTagName("trkseg")[0];
    removeAllChildren(segment);

    // Create new data points
    for(let i = 1; i < newDuration; i += gap) {
        const time = Math.floor(clock / 1000 + i) * 1000;
        const time2 = Math.floor(clock / 1000 + i * ratio) * 1000;
        const lat = splineLat.at(time2);
        const long = splineLong.at(time2);
        const elevation = splineElevation.at(time2);
        const heartRate = splineHeartRate ? splineHeartRate.at(time2) : null;
        const cadence = splineCadence ? splineCadence.at(time2) : null;
        
        const newNode = xmlDoc.createElement("trkpt");
        newNode.setAttribute("lat", lat.toString());
        newNode.setAttribute("lon", long.toString());

        const newElevation = xmlDoc.createElement("ele");
        newElevation.textContent = elevation;

        const newTime = xmlDoc.createElement("time");
        newTime.textContent = new Date(time).toISOString();

        if (heartRate || cadence) {
            const extensions = xmlDoc.createElement("extensions");
            const tpe = xmlDoc.createElement("ns3:TrackPointExtension");
            if (heartRate) {
                const newHeartRate = xmlDoc.createElement("ns3:hr");
                newHeartRate.textContent = Math.round(heartRate).toString();
                tpe.appendChild(newHeartRate);
            }
            if (cadence) {
                const newCadence = xmlDoc.createElement("ns3:cad");
                newCadence.textContent = cadence.toString();
                tpe.appendChild(newCadence);
            }
            extensions.appendChild(tpe);
            newNode.appendChild(extensions);
        }

        newNode.appendChild(newElevation);
        newNode.appendChild(newTime);

        segment.appendChild(newNode);
    }
    console.log(xmlDoc);
    document.getElementById("download").style.display = "block";
});

document.getElementById("download").addEventListener("click", function() {
  const serializer = new XMLSerializer();
  const gpxString = serializer.serializeToString(xmlDoc);

  const blob = new Blob([gpxString], { type: 'text/xml' });

  // Create a Download Link
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = "new.gpx";
  downloadLink.style.display = 'none';

  // Trigger the Download
  document.body.appendChild(downloadLink); // Append to the document
  downloadLink.click();
  document.body.removeChild(downloadLink); // Remove from the document
});

function removeAllChildren(node) {
  while (node.lastChild) {
    node.removeChild(node.lastChild);
  }
}

function secondsToHms(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
  
    const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay + sDisplay;
  }

  function hhmmssToSeconds(timeString) {
    const timeParts = timeString.split(':');
  
    if (timeParts.length !== 3) {
      return null; // Invalid format
    }
  
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    const seconds = parseInt(timeParts[2], 10);
  
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return null; // Invalid number
    }
  
    return hours * 3600 + minutes * 60 + seconds;
  }

function parseGPX(gpxText) {
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(gpxText, "text/xml");
    console.log(xmlDoc);

    // Extract gpx data
    const trackPoints = xmlDoc.getElementsByTagName("trkpt");
    const elevation = xmlDoc.getElementsByTagName("ele");
    const time = xmlDoc.getElementsByTagName("time");
    const heartRate = xmlDoc.getElementsByTagName("ns3:hr");
    const cadence = xmlDoc.getElementsByTagName("ns3:cad");
    let lats = [];
    let longs = [];
    let elevations = [];
    let times = [];
    let heartRates = [];
    let cadences = [];

    // Turn the data into a format that the spline function can use
    for (let i = 0; i < trackPoints.length; i++) {
        let lat = trackPoints[i].getAttribute("lat");
        let lon = trackPoints[i].getAttribute("lon");
        lats.push(parseFloat(lat));
        longs.push(parseFloat(lon));
        elevations.push(parseFloat(elevation[i].textContent));
        times.push(new Date(time[i].textContent).getTime());
        if (heartRate.length > 0) {
            heartRates.push(parseInt(heartRate[i].textContent));
        }
        if (cadence.length > 0) {
            cadences.push(parseInt(cadence[i].textContent));
        }
    }

    // Calculate and display total duration
    const duration = (times[times.length-1] - times[0]) / 1000;
    document.getElementById("duration").textContent += secondsToHms(duration);

    // Unhide elements
    document.getElementById("duration").style.display = "block";
    document.getElementById("targetText").style.display = "block";
    document.getElementById("targetBox").style.display = "block";
    document.getElementById("enter").style.display = "block";

    return {"lats": lats, "longs": longs, "elevations": elevations, "times": times, "heartRates": heartRates, "cadences": cadences};
}
