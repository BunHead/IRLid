document.addEventListener("DOMContentLoaded", function() {
    updateTimestamp();
    generateQRCodeWithLocation();
});

function generateQRCodeWithLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            // Construct Google Maps URL
            const googleMapsURL = `https://www.google.com/maps?q=${latitude},${longitude}`;
            generateQRCode(googleMapsURL); // Generates QR code for the URL
            // Display names and timestamp separately
            displayInfo("Alice", "Bob", new Date().toLocaleString());
        }, function(error) {
            console.error("Geolocation error:", error);
            // Handle error
        });
    } else {
        console.log("Geolocation is not supported by this browser.");
    }
}

function displayInfo(name1, name2, timestamp) {
    // Example function to display the names and timestamp separately
    // This can be adapted based on how you intend to display the information (e.g., updating DOM elements)
    console.log(`${name1} and ${name2} met at ${timestamp}`);
}



function generateQRCode(data) {
    const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(data)}`;
    document.getElementById('qrCodeImg').src = qrCodeURL;

    // Optionally, display the encoded data below the QR code or in console for debugging
    console.log("QR Code Data:", data);
}

document.getElementById('qrCodeImg').addEventListener('click', generateQRCodeWithLocation);

function updateTimestamp() {
    document.getElementById('timestamp').innerText = `Current Time: ${new Date().toLocaleTimeString()}`;
}

function fetchLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            document.getElementById('location').innerText = `Latitude: ${latitude}\nLongitude: ${longitude}`;
        }, function(error) {
            // Error handling
            let errorMessage = 'Error getting location: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += "User denied the request for Geolocation.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += "Location information is unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMessage += "The request to get user location timed out.";
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage += "An unknown error occurred.";
                    break;
            }
            document.getElementById('location').innerText = errorMessage;
        });
    } else {
        document.getElementById('location').innerText = "Geolocation is not supported by this browser.";
    }
}

// Call fetchLocation when you want to get the location, for example, on page load or on a button click.
fetchLocation();
