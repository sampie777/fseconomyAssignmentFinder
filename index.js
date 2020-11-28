function getInterestingAssignments() {
    const maxDistance = 70;
    const minPay = 1600;

    let _airports = [];
    const _proposeAirportModalId = "proposeAirport-Modal";

    class Airport {
        constructor(
            code,
            size,
            location,
            country
        ) {
            this.code = code;
            this.size = size;
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
                    distance,
                    bearing,
                    cargo,
                    typ,
                    aircraft,
                    expires) {
            this.pay = pay;
            this.from = from;
            this.destination = destination;
            this.distance = distance;
            this.bearing = bearing;
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
            rentalPrice,
            bonus) {
            this.href = href;
            this.id = id;
            this.typ = typ;
            this.equipment = equipment;
            this.home = home;
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

    const loadAirports = () => fetch("https://server.fseconomy.net/airport.jsp", {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Upgrade-Insecure-Requests": "1"
        },
        "referrer": "https://server.fseconomy.net/airport.jsp",
        "body": "icao=&registration=&name=&model=1&rentable=rentable&distance=10&from=&goodsMode=sell&commodity=&minAmount=100&submit=true",
        "method": "POST",
        "mode": "cors"
    })
        .then(d => d.text());

    const loadAirport = (airport) => fetch("https://server.fseconomy.net/airport.jsp?icao=" + airport.code, {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Upgrade-Insecure-Requests": "1"
        },
        "referrer": "https://server.fseconomy.net/airport.jsp",
        "method": "GET",
        "mode": "cors"
    })
        .then(d => d.text());

    function processAirports(text) {
        console.debug("  (Storing API return output in variable: window.airportsText");
        window.airportsText = text;

        const airportCodes = Array.from(text.matchAll(/href="airport.jsp\?icao=(.*?)">/g), m => m[1]);
        const airportSizes = Array.from(text.matchAll(/<img src="\/img\/(.*?)\.gif"/g), m => m[1]);
        const airportLocations = Array.from(text.matchAll(/<\/td>\r?\n[ \t]*\r?\n[ \t]*<td>(.*)\r?\n[ \t]*<\/td>\r?\n[ \t]*<td>(.*)/gm), m => m[1]);
        const airportCountries = Array.from(text.matchAll(/<\/td>\r?\n[ \t]*\r?\n[ \t]*<td>(.*)\r?\n[ \t]*<\/td>\r?\n[ \t]*<td>(.*)/gm), m => m[2]);

        const airports = [];
        for (let i = 0; i < airportCodes.length; i++) {
            airports.push(new Airport(
                airportCodes[i],
                airportSizes[i],
                airportLocations[i],
                airportCountries[i],
            ));
        }
        return airports;
    }

    function processAirport(airport, text) {
        console.log("Storing API return output in variable: window.airportText");
        window.airportText = text;

        let html = document.createElement("html");
        html.innerHTML = text;
        const assignmentTable = html.querySelector(".assigmentTable");
        const aircraftTable = html.querySelector(".aircraftTable");
        html = null;

        function extractAssignments() {
            const rows = assignmentTable.querySelectorAll("tbody tr");

            const assignments = [];
            Array.from(rows).forEach(row => {
                let columns = row.querySelectorAll("td");
                if (columns.length === 1) {
                    return
                }

                assignments.push(new Assignment(
                    columns[1].innerText.trim()
                        .replace("$", "")
                        .replace(",", "") * 1,   // pay
                    columns[2].innerText.trim(),     // from
                    columns[3].innerText.trim(),     // destination
                    columns[4].innerText.trim()
                        .replace(",", "") * 1,    // distance
                    columns[5].innerText.trim()
                        .replace(",", "") * 1,    // bearing
                    columns[6].innerText.trim(),     // cargo
                    columns[7].innerText.trim(),     // typ
                    columns[8].innerText.trim(),     // aircraft
                    columns[9].innerText.trim(),     // expires
                ));
            });
            return assignments;
        }

        function extractAircraft() {
            const rows = aircraftTable.querySelectorAll("tbody tr");

            const aircraft = [];
            Array.from(rows).forEach(row => {
                let columns = row.querySelectorAll("td");
                if (columns.length === 1) {
                    return
                }
                aircraft.push(new Aircraft(
                    columns[0].querySelector("a").href,    // href
                    columns[0].innerText.trim(),    // id
                    columns[1].innerText.trim(),    // type
                    columns[2].innerText.trim(),    // equipment
                    columns[3].innerText.trim(),    // home
                    columns[4].innerText.trim(),    // price
                    columns[5].innerText.trim()
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
        console.log("  Process assignments...");
        airport.interestingAssignments = filterAssignments(airport.assignments);
    }

    function removeModal() {
        const modal = document.getElementById(_proposeAirportModalId);
        if (modal !== null) {
            modal.parentNode.removeChild(modal);
        }
    }

    function exitProcess() {
        console.log("Exiting");
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
            // return nextAirport();
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
        background-color: rgba(0, 0, 0, 0.1);
    }

    .proposeAirport-Content {
        background-color: #ffffff;
        width: 80%;
        max-width: 850px;
        margin: 0 auto;
        margin-top: 50px;
        padding: 50px 80px;
        border: 1px solid #888;
        border-radius: 4px;
        overflow-x: auto;
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
            <th>Pay</th>
            <th>Destination</th>
            <th>Distance</th>
            <th>Cargo</th>
            <th>Expires</th>
        </tr>
        </thead>
        <tbody>
        ${airport.interestingAssignments.reduce((acc, cur) => acc + `
        <tr>
            <td>\$ ${cur.pay}</td>
            <td>
                <a href="airport.jsp?icao=${cur.destination}" target="_blank">${cur.destination}</a>
            </td>
            <td>${cur.distance}</td>
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
            <th>ID</th>
            <th>Type</th>
            <th>Equipment</th>
            <th>Home</th>
            <th>Price</th>
            <th>Bonus</th>
        </tr>
        </thead>
        <tbody>
        ${airport.aircraft.reduce((acc, cur) => acc + `
        <tr>
            <td>
                <a href="${cur.href}" target="_blank">${cur.id}</a>
            </td>
            <td>${cur.typ}</td>
            <td>${cur.equipment}</td>
            <td>
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
                style="background-color: #ff9b9b; ">
            Exit
        </button>
        <button id="proposeAirport-Next"
                style="background-color: #d1e9ff; ">
            Next
        </button>
    </div>
</div>`;
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

    function process() {
        console.log("Loading all airports...");
        loadAirports()
            .then(text => processAirports(text))
            .then(airports => findAirportWithAssignments(airports))
            .catch(error => {
                console.error('Error loading/processing airports', error);
                alert("Failed to process airports");
            });
    }

    process();
}
