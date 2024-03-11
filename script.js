document.addEventListener("DOMContentLoaded", function() {
    updateTimestamp();
    generateQRCodeWithLocation();
});

function generateQRCodeWithLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const timestamp = new Date().toLocaleString();
            const data = `Latitude: ${latitude}, Longitude: ${longitude}, Timestamp: ${timestamp}`;
            generateQRCode(data);
        }, function(error) {
            console.error("Geolocation error:", error);
            const fallbackData = `Unable to fetch location, Timestamp: ${new Date().toLocaleString()}`;
            generateQRCode(fallbackData);
        });
    } else {
        console.log("Geolocation is not supported by this browser.");
    }
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
