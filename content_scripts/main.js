(function () {
    /**
     * Check and set a global guard variable.
     * If this content script is injected into the same page again,
     * it will do nothing next time.
     */
    if (window.fseconomyAssignmentFinderHasRun) {
        return;
    }
    window.fseconomyAssignmentFinderHasRun = true;

    function runAssignmentFinder(data) {
        console.log("Running assignment finder with data: ", data);
        getInterestingAssignments(data["maxDistance"],
                                  data["minPay"],
                                  data["useCurrentWebpage"],
                                  data["preferredAircraft"],
        );
    }

    /**
     * Listen for messages from the background script.
     */
    browser.runtime.onMessage.addListener((message) => {
        if (message.command === "fseconomyAssignmentFinder-run") {
            runAssignmentFinder(message.data);
        }
    });


    function getInterestingAssignments(maxDistance, minPay, useCurrentWebpage, preferredAircraft) {
        let _airports = [];
        const _proposeAirportModalId = "proposeAirport-Modal";

        class Airport {
            constructor(
                code,
                size,
                image,
                location,
                country
            ) {
                this.code = code;
                this.size = size;
                this.image = image;
                this.location = location;
                this.country = country;

                this.assignments = [];
                this.interestingAssignments = [];
                this.aircraft = [];
            }
        }

        class Assignment {
            constructor(pay,
                        from,
                        destination,
                        destinationImage,
                        distance,
                        bearing,
                        bearingImage,
                        cargo,
                        typ,
                        aircraft,
                        expires) {
                this.pay = pay;
                this.from = from;
                this.destination = destination;
                this.destinationImage = destinationImage;
                this.distance = distance;
                this.bearing = bearing;
                this.bearingImage = bearingImage;
                this.cargo = cargo;
                this.typ = typ;
                this.aircraft = aircraft;
                this.expires = expires;
            }
        }

        class Aircraft {
            constructor(
                href,
                id,
                typ,
                equipment,
                home,
                homeBearingImage,
                rentalPrice,
                bonus) {
                this.href = href;
                this.id = id;
                this.typ = typ;
                this.equipment = equipment;
                this.home = home;
                this.homeBearingImage = homeBearingImage;
                this.rentalPrice = rentalPrice;
                this.bonus = bonus;
            }
        }

        function groupBy(list, key) {
            return list.reduce((accumulator, current) => {
                accumulator[current[key]] = accumulator[current[key]] || []
                accumulator[current[key]].push(current);
                return accumulator;
            }, {});
        }

        const loadAirports = () => {
            if (useCurrentWebpage) {
                console.log("  Fetching airports from current page...");
                return new Promise(resolve => resolve(document.body.innerHTML));
            }

            console.log("  Fetching airports from API...");
            return fetch("https://server.fseconomy.net/airport.jsp", {
                "credentials": "include",
                "body": "icao=&registration=&name=&model=1&rentable=rentable&distance=10&from=&goodsMode=sell&commodity=&minAmount=100&submit=true",
                "method": "POST",
                "mode": "cors"
            })
                .then(d => d.text());
        }

        const loadAirport = (airport) => fetch("https://server.fseconomy.net/airport.jsp?icao=" + airport.code, {
            "credentials": "include",
            "method": "GET",
            "mode": "cors"
        })
            .then(d => d.text());

        function processAirports(text) {
            console.log("  Processing airports...");

            let html = document.createElement("html");
            html.innerHTML = text;
            const table = html.querySelector(".goodssearchTable");
            html = null;

            if (table === null) {
                if (useCurrentWebpage) {
                    console.error("Could not find airports table. Are you sure you are using the right page?");
                    alert("Could not find airports table. Are you sure you are on the right page?");
                } else {
                    console.error("Could not find airports table. API probably returned a wrong response:", text);
                    alert("Could not find airports table. API probably returned a wrong response.");
                }
                return [];
            }

            const columnNamesElements = table.querySelectorAll("thead tr th");
            const columnNames = Array.from(columnNamesElements).map(e => e.innerText.trim().toLowerCase());
            const codeColumn = columnNames.indexOf("ICAO".toLowerCase());
            const imageColumn = columnNames.indexOf("ICAO".toLowerCase());
            const locationColumn = columnNames.indexOf("Name".toLowerCase());
            const countryColumn = columnNames.indexOf("Country".toLowerCase());

            const rows = table.querySelectorAll("tbody tr");

            const airports = [];
            Array.from(rows).forEach(row => {
                let columns = row.querySelectorAll("td");
                if (columns.length === 1) {
                    return
                }

                let image = "";
                const imageElement = columns[imageColumn].querySelector("img")
                if (imageElement !== null) {
                    image = imageElement.src.match(/\/img\/.*?\.gif/)[0]
                }

                airports.push(new Airport(
                    columns[codeColumn].innerText.trim(),    // code
                    image.match(/\/img\/(.*?)\.gif/)[1],  // size
                    image,  // image
                    columns[locationColumn].innerText.trim(),    // location
                    columns[countryColumn].innerText.trim(),    // country
                ));
            });
            return airports;
        }

        function processAirport(airport, text) {
            console.log("  Processing airport...");

            let html = document.createElement("html");
            html.innerHTML = text;
            const assignmentTable = html.querySelector(".assigmentTable");
            const aircraftTable = html.querySelector(".aircraftTable");
            html = null;

            function extractAssignments() {
                const columnNamesElements = assignmentTable.querySelectorAll("thead tr th");
                const columnNames = Array.from(columnNamesElements).map(e => e.innerText.trim().toLowerCase());
                const payColumn = columnNames.indexOf("Pay".toLowerCase());
                const fromColumn = columnNames.indexOf("From".toLowerCase());
                const destinationColumn = columnNames.indexOf("Dest".toLowerCase());
                const destinationImageColumn = columnNames.indexOf("Dest".toLowerCase());
                const distanceColumn = columnNames.indexOf("NM".toLowerCase());
                const bearingColumn = columnNames.indexOf("Brg".toLowerCase());
                const bearingImageColumn = columnNames.indexOf("Brg".toLowerCase());
                const cargoColumn = columnNames.indexOf("Cargo".toLowerCase());
                const typColumn = columnNames.indexOf("Type".toLowerCase());
                const aircraftColumn = columnNames.indexOf("Aircraft".toLowerCase());
                const expiresColumn = columnNames.indexOf("Expires".toLowerCase());

                const rows = assignmentTable.querySelectorAll("tbody tr");

                const assignments = [];
                Array.from(rows).forEach(row => {
                    let columns = row.querySelectorAll("td");
                    if (columns.length === 1) {
                        return
                    }

                    let destinationImage = "";
                    const destinationImageElement = columns[destinationImageColumn].querySelector("img")
                    if (destinationImageElement !== null) {
                        destinationImage = destinationImageElement.src.match(/\/img\/.*?\.gif/)[0]
                    }

                    let bearingImage = "";
                    const bearingImageElement = columns[bearingImageColumn].querySelector("img")
                    if (bearingImageElement !== null) {
                        bearingImage = bearingImageElement.src.match(/\/img\/.*?\.gif/)[0]
                    }

                    assignments.push(new Assignment(
                        columns[payColumn].innerText.trim()
                                          .replace("$", "")
                                          .replace(",", "") * 1,   // pay
                        columns[fromColumn].innerText.trim(),     // from
                        columns[destinationColumn].innerText.trim(),     // destination
                        destinationImage,     // destinationImage
                        columns[distanceColumn].innerText.trim()
                                               .replace(",", "") * 1,    // distance
                        columns[bearingColumn].innerText.trim()
                                              .replace(",", "") * 1,    // bearing
                        bearingImage,  // bearingImage
                        columns[cargoColumn].innerText.trim(),     // cargo
                        columns[typColumn].innerText.trim(),     // typ
                        columns[aircraftColumn].innerText.trim(),     // aircraft
                        columns[expiresColumn].innerText.trim(),     // expires
                    ));
                });
                return assignments;
            }

            function extractAircraft() {
                const columnNamesElements = aircraftTable.querySelectorAll("thead tr th");
                const columnNames = Array.from(columnNamesElements).map(e => e.innerText.trim().toLowerCase());
                const hrefColumn = columnNames.indexOf("Id".toLowerCase());
                const idColumn = columnNames.indexOf("Id".toLowerCase());
                const typColumn = columnNames.indexOf("Type".toLowerCase());
                const equipmentColumn = columnNames.indexOf("Equipment".toLowerCase());
                const homeColumn = columnNames.indexOf("Home".toLowerCase());
                const homeBearingImageColumn = columnNames.indexOf("Bonus".toLowerCase());
                const rentalPriceColumn = columnNames.indexOf("Rental Price".toLowerCase());
                const bonusColumn = columnNames.indexOf("Bonus".toLowerCase());


                const rows = aircraftTable.querySelectorAll("tbody tr");

                const aircraft = [];
                Array.from(rows).forEach(row => {
                    let columns = row.querySelectorAll("td");
                    if (columns.length === 1) {
                        return
                    }

                    let homeBearingImage = "";
                    const bearingImageElement = columns[homeBearingImageColumn].querySelector("img")
                    if (bearingImageElement !== null) {
                        homeBearingImage = bearingImageElement.src.match(/\/img\/.*?\.gif/)[0]
                    }

                    aircraft.push(new Aircraft(
                        columns[hrefColumn].querySelector("a").href,    // href
                        columns[idColumn].innerText.trim(),    // id
                        columns[typColumn].innerText.trim(),    // type
                        columns[equipmentColumn].innerText.trim(),    // equipment
                        columns[homeColumn].innerText.trim(),    // home
                        homeBearingImage,  // homeBearingImage
                        columns[rentalPriceColumn].innerText.trim(),    // price
                        columns[bonusColumn].innerText.trim()
                                            .replace("$", "")
                                            .replace(",", "") * 1,   // bonus
                    ));
                });
                return aircraft;
            }

            airport.assignments = extractAssignments();
            airport.aircraft = extractAircraft();
        }

        function filterAssignments(assignments) {
            const filteredByDistance = assignments.filter(a => a.distance < maxDistance);

            const destinations = groupBy(filteredByDistance, "destination");

            let filteredByPay = [];
            Object.entries(destinations).forEach(destination => {
                // const name = destination[0];
                const airports = destination[1];
                const totalPay = airports.reduce((acc, current) => acc + current.pay, 0);
                if (totalPay >= minPay) {
                    filteredByPay = filteredByPay.concat(airports);
                }
            });

            filteredByPay.sort((a, b) => a.distance - b.distance);

            return filteredByPay;
        }

        function processAssignments(airport) {
            console.log("  Processing assignments...");
            airport.interestingAssignments = filterAssignments(airport.assignments);
        }

        function removeModal() {
            const modal = document.getElementById(_proposeAirportModalId);
            if (modal !== null) {
                modal.parentNode.removeChild(modal);
            }
        }

        function exitProcess() {
            console.debug("Exiting");
            removeModal();
        }

        function nextAirport() {
            if (_airports.length === 0) {
                console.log("No more airports left");
                alert("No more airports left");
                return exitProcess();
            }

            const nextButton = document.getElementById("proposeAirport-Next");
            if (nextButton !== null) {
                nextButton.parentNode.innerText = "Loading...";
            }

            const airport = _airports.shift();
            window.airport = airport;
            console.log("Fetching next airport: " + airport.code + "... (" + (_airports.length) + " airports left)")
            loadAirport(airport)
                .then(text => {
                    processAirport(airport, text);
                    processAssignments(airport);
                    proposeAirport(airport);
                })
                .catch(error => {
                    console.error('Error loading/processing airport', error);
                    alert("Failed to process airport " + airport.code);
                    exitProcess();
                });
        }

        function proposeAirport(airport) {
            if (airport.interestingAssignments.length === 0) {
                console.log("  Airport has no interesting assignments, skipping this one", airport);
                return nextAirport();
            }
            console.log("  Proposing airport...", airport);

            removeModal();

            const modal = document.createElement("div");
            modal.id = _proposeAirportModalId;
            modal.innerHTML = `<style>
    #proposeAirport-Modal {
        z-index: 2000;
        position: fixed;
        width: 100%;
        height: 100%;
        overflow: auto;
        top: 0;
        left: 0;
        background-color: rgba(0, 0, 0, 0.2);
    }

    .proposeAirport-Content {
        background-color: #ffffff;
        width: 80%;
        max-width: 1100px;
        margin: 50px auto 150px;
        padding: 50px 80px;
        border: 1px solid #888;
        border-radius: 4px;
        overflow-x: auto;
        box-shadow: 0 4px 5px 1px rgba(0, 0, 0, 0.2);
    }

    #proposeAirport-Modal table {
        width: 100%;
    }

    #proposeAirport-Modal table tr td, #proposeAirport-Modal table tr th {
        padding: 1px 5px
    }

    #proposeAirport-Modal table tbody tr:hover {
        background-color: #f4f4f4;
    }

    #proposeAirport-Modal table tr.aircraft-match {
        background-color: #ecf1ff;
    }

    .proposeAirport-Title {
        text-align: center;
        font-size: 22pt;
    }

    .proposeAirport-Title span {
        margin-left: -47px;
    }

    .proposeAirport-Title a {
        font-size: 38pt;
    }

    .proposeAirport-Title img {
        margin-top: -3px;
    }

    #proposeAirport-Modal button {
        font-size: 14pt;
        padding: 4px 30px;
        border-radius: 7px;
        border: 1px solid #888;
        margin: auto 10px;
    }
</style>
<div class="proposeAirport-Content">

    <div class="proposeAirport-Title">
        <span>Airport:</span>
        <a href="airport.jsp?icao=${airport.code}" target="_blank">${airport.code}</a>
        <a href="#" id="gmap" title="Click to open map of this airport"
           onclick="gmap.setSize(620,530);gmap.setUrl('gmap.jsp?icao=${airport.code}');gmap.showPopup('gmap');return false;">
            <img src="${airport.image}" alt=""/>
        </a>
    </div>
    <p>
        <i>${airport.location}</i>
    </p>

    <p>
        <strong>${airport.interestingAssignments.length} Interesting assignments</strong>
    </p>
    <table>
        <thead>
        <tr>
            <th style="width: 75px">Pay</th>
            <th style="width: 100px">Destination</th>
            <th style="width: 85px">Distance</th>
            <th>Cargo</th>
            <th style="width: 90px">Expires</th>
        </tr>
        </thead>
        <tbody>
        ${airport.interestingAssignments.reduce((acc, cur) => acc + `
        <tr>
            <td>\$ ${cur.pay}</td>
            <td>
                <a href="#" id="gmap" title="Click to open map of this airport"
                   onclick="gmap.setSize(620,530);gmap.setUrl('gmap.jsp?icao=${cur.destination}');gmap.showPopup('gmap');return false;">
                    <img src="${cur.destinationImage}" alt=""/>
                </a>
                <a href="airport.jsp?icao=${cur.destination}" target="_blank">${cur.destination}</a>
            </td>
            <td>
                ${cur.distance}
                <a href="#" id="gmap" title="Click to open map with main airport and this airport in one view"
                   onclick="gmap.setSize(620,530);gmap.setUrl('gmap.jsp?icao=${airport.code}&icaod=${cur.destination}');gmap.showPopup('gmap');return false;">
                    <img src="${cur.bearingImage}" alt=""/>
                </a>
            </td>
            <td>${cur.cargo}</td>
            <td>${cur.expires}</td>
        </tr>
        `, "")}
        </tbody>
    </table>
    <br/>
    <p><strong>Available aircraft:</strong></p>
    <table>
        <thead>
        <tr>
            <th style="width: 85px">ID</th>
            <th>Type</th>
            <th style="width: 100px">Equipment</th>
            <th style="width: 80px">Home</th>
            <th style="min-width: 130px">Price</th>
            <th style="width: 70px">Bonus</th>
        </tr>
        </thead>
        <tbody>
        ${airport.aircraft.reduce((acc, cur) => acc + `
        <tr class="${(new RegExp(preferredAircraft, "i")).test(cur.typ) ? "aircraft-match" : ""}">
            <td>
                <a href="${cur.href}" target="_blank">${cur.id}</a>
            </td>
            <td>${cur.typ}</td>
            <td>${cur.equipment}</td>
            <td>
                <a href="#" id="gmap" title="Click to open map with main airport and this airport in one view"
                   onclick="gmap.setSize(620,530);gmap.setUrl('gmap.jsp?icao=${airport.code}&icaod=${cur.home}');gmap.showPopup('gmap');return false;">
                        <img src="${cur.homeBearingImage}" alt=""/>
                </a>
                <a href="airport.jsp?icao=${cur.home}" target="_blank">${cur.home}</a>
            </td>
            <td>${cur.rentalPrice}</td>
            <td>\$ ${cur.bonus}</td>
        </tr>
        `, "")}
        </tbody>
    </table>

    <div style="margin-top: 40px; text-align: center;">
        <button id="proposeAirport-Exit"
                style="color: #7a5959; ">
            Exit
        </button>
        <button id="proposeAirport-Next"
                style="background-color: #d1e9ff; ">
            Next
        </button>
    </div>
</div>
`;
            document.body.appendChild(modal);

            const exitButton = document.getElementById("proposeAirport-Exit");
            const nextButton = document.getElementById("proposeAirport-Next");

            exitButton.addEventListener('click', exitProcess);
            nextButton.addEventListener('click', nextAirport);
        }

        function findAirportWithAssignments(airports) {
            _airports = airports;
            window.airports = _airports;
            nextAirport();
        }

        function runProcess() {
            console.log("Loading all airports...");
            loadAirports()
                .then(text => processAirports(text))
                .then(airports => findAirportWithAssignments(airports))
                .catch(error => {
                    console.error('Error loading/processing airports', error);
                    alert("Failed to process airports");
                });
        }

        runProcess();
    }
})();
