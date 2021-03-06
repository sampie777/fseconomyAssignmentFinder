function runPopupScript() {
    function executeFrontend(tabs, data) {
        browser.tabs.sendMessage(tabs[0].id, {
            command: "fseconomyAssignmentFinder-run",
            data: data
        });
    }

    document.getElementById('form')
            .addEventListener('submit', function (e) {
                e.preventDefault();
                document.querySelector(".controls").innerHTML = "Loading...";

                const data = {
                    "maxDistance": document.querySelector("input[name=maxDistance]").value,
                    "minPay": document.querySelector("input[name=minPay]").value,
                    "preferredAircraft": document.querySelector("input[name=preferredAircraft]").value.trim(),
                    "useCurrentWebpage": document.querySelector("input[name=useCurrentWebpage]").checked,
                }

                browser.tabs.query({active: true, currentWindow: true})
                       .then(tabs => executeFrontend(tabs, data))
                       .catch(error => {
                           console.error("Error while sending data to frontend", error);
                           document.getElementById("errors").innerText = `Error (2): ${error.message}`;
                       });
            });

}

browser.tabs.executeScript({file: "/content_scripts/main.js"})
       .then(runPopupScript)
       .catch(error => {
           console.error("Failed to execute content script for assignment finder", error);
           document.getElementById("errors").innerText = `Error (1): ${error.message}`;
       });
