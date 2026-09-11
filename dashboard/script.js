// ==========================================
// EdgeGuard-μGrid Dashboard
// ==========================================

const API_URL = window.location.origin;

const AUTH_TOKEN =
    sessionStorage.getItem("edgeguard_token");

const AUTH_HEADERS = AUTH_TOKEN
    ? {
        "Authorization": `Bearer ${AUTH_TOKEN}`
    }
    : {};


// ==========================================
// CURRENT CHART
// ==========================================

const chartCanvas =
    document.getElementById("currentChart");

let currentChart = null;

if (chartCanvas) {

    const chartContext =
        chartCanvas.getContext("2d");

    currentChart = new Chart(chartContext, {

        type: "line",

        data: {

            labels: [],

            datasets: [

                {
                    label: "Device 1",
                    data: [],
                    tension: 0.3
                },

                {
                    label: "Device 2",
                    data: [],
                    tension: 0.3
                },

                {
                    label: "Device 3",
                    data: [],
                    tension: 0.3
                }

            ]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            animation: false,

            scales: {

                y: {
                    beginAtZero: false
                }

            }

        }

    });

}


// ==========================================
// FETCH SENSOR DATA
// ==========================================

async function fetchSensorData() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/devices`,
                {
                    headers: AUTH_HEADERS
                }
            );

        if (!response.ok) {

            throw new Error(
                "Backend response error"
            );

        }

        const data =
            await response.json();

        updateDashboard(data);

        updateLastUpdate();

        const systemStatus =
            document.getElementById(
                "systemStatus"
            );

        const mqttStatus =
            document.getElementById(
                "mqttStatus"
            );

        if (systemStatus) {

            systemStatus.textContent =
                "SYSTEM ONLINE";

        }

        if (mqttStatus) {

            mqttStatus.textContent =
                "CONNECTED";

        }

    }

    catch (error) {

        console.error(
            "Unable to connect to backend:",
            error
        );

        const systemStatus =
            document.getElementById(
                "systemStatus"
            );

        const mqttStatus =
            document.getElementById(
                "mqttStatus"
            );

        if (systemStatus) {

            systemStatus.textContent =
                "BACKEND OFFLINE";

        }

        if (mqttStatus) {

            mqttStatus.textContent =
                "DISCONNECTED";

        }

    }

}


// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard(data) {

    updateDevice(
        1,
        data.device1
    );

    updateDevice(
        2,
        data.device2
    );

    updateDevice(
        3,
        data.device3
    );

    updateDeviceStatus(data);

    updateMLRisk(data);

    updateChart(data);

}


// ==========================================
// UPDATE DEVICE VALUES
// ==========================================

function updateDevice(
    deviceNumber,
    device
) {

    if (!device) {

        return;

    }

    const current =
        document.getElementById(
            `current${deviceNumber}`
        );

    const voltage =
        document.getElementById(
            `voltage${deviceNumber}`
        );

    const power =
        document.getElementById(
            `power${deviceNumber}`
        );

    if (current) {

        current.textContent =
            device.current ?? "--";

    }

    if (voltage) {

        voltage.textContent =
            device.voltage ?? "--";

    }

    if (power) {

        power.textContent =
            device.power ?? "--";

    }

}


// ==========================================
// DEVICE STATUS
// ==========================================

function updateDeviceStatus(data) {

    updateStatusBadge(
        "status1",
        data.device1?.status || "NORMAL"
    );

    updateStatusBadge(
        "status2",
        data.device2?.status || "NORMAL"
    );

    updateStatusBadge(
        "status3",
        data.device3?.status || "NORMAL"
    );

}


// ==========================================
// STATUS BADGE
// ==========================================

function updateStatusBadge(
    elementId,
    status
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {

        return;

    }

    element.textContent =
        status;

    element.className =
        "badge";

    if (status === "NORMAL") {

        element.classList.add(
            "normal"
        );

    }

    else if (status === "WARNING") {

        element.classList.add(
            "warning"
        );

    }

    else if (status === "ANOMALY") {

        element.classList.add(
            "anomaly"
        );

    }

}


// ==========================================
// ML RISK
// ==========================================

function updateMLRisk(data) {

    const risks = [

        data.device1?.risk,
        data.device2?.risk,
        data.device3?.risk

    ].filter(Boolean);

    const riskElement =
        document.getElementById(
            "mlRisk"
        );

    if (!riskElement) {

        return;

    }

    if (risks.includes("HIGH")) {

        riskElement.textContent =
            "HIGH";

    }

    else if (risks.includes("MEDIUM")) {

        riskElement.textContent =
            "MEDIUM";

    }

    else {

        riskElement.textContent =
            "LOW";

    }

}


// ==========================================
// LAST UPDATE
// ==========================================

function updateLastUpdate() {

    const element =
        document.getElementById(
            "lastUpdate"
        );

    if (!element) {

        return;

    }

    const now =
        new Date();

    element.textContent =
        now.toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata"
            }
        );

}


// ==========================================
// UPDATE CURRENT CHART
// ==========================================

function updateChart(data) {

    if (!currentChart) {

        return;

    }

    const time =
        new Date().toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZone: "Asia/Kolkata"
            }
        );

    currentChart.data.labels.push(
        time
    );

    currentChart.data.datasets[0].data.push(
        data.device1?.current ?? null
    );

    currentChart.data.datasets[1].data.push(
        data.device2?.current ?? null
    );

    currentChart.data.datasets[2].data.push(
        data.device3?.current ?? null
    );

    if (
        currentChart.data.labels.length >
        20
    ) {

        currentChart.data.labels.shift();

        currentChart.data.datasets.forEach(
            dataset => {

                dataset.data.shift();

            }
        );

    }

    currentChart.update();

}


// ==========================================
// FETCH ALERTS + NOTIFICATION
// ==========================================

let lastAlertId = null;

async function fetchAlerts() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/alerts`,
                {
                    headers: AUTH_HEADERS
                }
            );

        if (!response.ok) {

            throw new Error(
                "Alerts API error"
            );

        }

        const alerts =
            await response.json();

        // --------------------------------------
        // CHECK FOR NEW ALERT
        // --------------------------------------

        if (alerts && alerts.length > 0) {

            const newestAlert =
                alerts[0];

            // First load: remember the latest
            // alert but don't notify for old alerts
            if (lastAlertId === null) {

                lastAlertId =
                    newestAlert.id;

            }

            // New alert detected
            else if (
                newestAlert.id >
                lastAlertId
            ) {

                lastAlertId =
                    newestAlert.id;

                showAlertNotification(
                    newestAlert
                );

            }

        }

        updateAlerts(alerts);

    }

    catch (error) {

        console.error(
            "Unable to load alerts:",
            error
        );

    }

}

// ==========================================
// BROWSER ALERT NOTIFICATION
// ==========================================

function showAlertNotification(alert) {

    const title =
        `🚨 ${alert.severity} ALERT`;

    const message =
        `Device ${alert.device_id}: ${alert.message}`;

    // --------------------------------------
    // Browser notification
    // --------------------------------------

    if (
        "Notification" in window
    ) {

        if (
            Notification.permission ===
            "granted"
        ) {

            new Notification(
                title,
                {
                    body: message
                }
            );

        }

        else if (
            Notification.permission !==
            "denied"
        ) {

            Notification.requestPermission()
                .then(permission => {

                    if (
                        permission ===
                        "granted"
                    ) {

                        new Notification(
                            title,
                            {
                                body: message
                            }
                        );

                    }

                });

        }

    }

    // --------------------------------------
    // Also show dashboard popup
    // --------------------------------------

    const popup =
        document.createElement(
            "div"
        );

    popup.className =
        "live-alert-notification";

    popup.innerHTML = `
        <strong>🚨 ${alert.severity} ALERT</strong>
        <p>
            Device ${alert.device_id}
        </p>
        <p>
            ${alert.message}
        </p>
    `;

    document.body.appendChild(
        popup
    );

    setTimeout(() => {

        popup.remove();

    }, 5000);

}


// ==========================================
// UPDATE ALERTS UI
// ==========================================

function updateAlerts(alerts) {

    const container =
        document.getElementById(
            "alerts"
        );

    if (!container) {

        return;

    }

    if (
        !alerts ||
        alerts.length === 0
    ) {

        container.innerHTML = `

            <div class="alert normal-alert">

                <span>●</span>

                <div>

                    <strong>
                        System normal
                    </strong>

                    <p>
                        No abnormal events detected.
                    </p>

                </div>

            </div>

        `;

        return;

    }

    container.innerHTML =
        alerts.map(alert => {

            let alertClass =
                "normal-alert";

            let icon =
                "●";

            if (
                alert.severity ===
                "MEDIUM"
            ) {

                alertClass =
                    "warning-alert";

                icon =
                    "⚠";

            }

            else if (
                alert.severity ===
                "HIGH"
            ) {

                alertClass =
                    "danger-alert";

                icon =
                    "⚠";

            }

            return `

                <div class="alert ${alertClass}">

                    <span>
                        ${icon}
                    </span>

                    <div>

                        <strong>
                            Device ${alert.device_id}
                            — ${alert.severity}
                        </strong>

                        <p>
                            ${alert.message}
                        </p>

                        <small>

                            ${
                                alert.status ===
                                "UNRESOLVED"

                                ? `
                                    <button
                                        class="acknowledge-btn"
                                        data-alert-id="${alert.id}"
                                    >
                                        Acknowledge
                                    </button>
                                `

                                : `
                                    <span>
                                        ✓ Acknowledged
                                    </span>
                                `
                            }

                            ${formatAlertTime(
                                alert.timestamp
                            )}

                        </small>

                    </div>

                </div>

            `;

        }).join("");

}


// ==========================================
// RESOLVE ALERT
// ==========================================

async function resolveAlert(
    alertId
) {

    try {

        const response =
            await fetch(
                `${API_URL}/api/alerts/${alertId}/resolve`,
                {
                    method: "PATCH",
                    headers: AUTH_HEADERS
                }
            );

        if (!response.ok) {

            throw new Error(
                "Unable to resolve alert"
            );

        }

        fetchAlerts();

        fetchAuditLogs();

    }

    catch (error) {

        console.error(
            "Resolve alert error:",
            error
        );

    }

}


// ==========================================
// FORMAT ALERT TIME
// ==========================================

function formatAlertTime(
    timestamp
) {

    if (!timestamp) {

        return "";

    }

    /*
     * SQLite timestamp is already treated
     * as local IST time.
     *
     * DO NOT add "Z" here.
     */

    const date =
        new Date(
            timestamp.replace(
                " ",
                "T"
            )
        );

    if (
        isNaN(
            date.getTime()
        )
    ) {

        return timestamp;

    }

    return date.toLocaleString(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }
    );

}


// ==========================================
// FETCH SENSOR HISTORY
// ==========================================

async function fetchHistory() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/history`,
                {
                    headers: AUTH_HEADERS
                }
            );

        if (!response.ok) {

            throw new Error(
                "History API error"
            );

        }

        const history =
            await response.json();

        updateHistoryTable(history);

    }

    catch (error) {

        console.error(
            "Unable to load sensor history:",
            error
        );

    }

}


// ==========================================
// UPDATE HISTORY TABLE
// ==========================================

function updateHistoryTable(
    history
) {

    const tableBody =
        document.getElementById(
            "historyTableBody"
        );

    if (!tableBody) {

        return;

    }

    if (
        !history ||
        history.length === 0
    ) {

        tableBody.innerHTML = `

            <tr>

                <td colspan="6">
                    No readings available
                </td>

            </tr>

        `;

        return;

    }

    tableBody.innerHTML =
        history.map(reading => {

            const status =
                reading.status ??
                "NORMAL";

            const risk =
                reading.risk ??
                "LOW";

            return `

                <tr>

                    <td>
                        Device ${reading.device_id}
                    </td>

                    <td>
                        ${reading.current ?? "--"}
                    </td>

                    <td>
                        ${reading.voltage ?? "--"}
                    </td>

                    <td>

                        <span class="history-status ${status.toLowerCase()}">

                            ${status}

                        </span>

                    </td>

                    <td>

                        <span class="history-risk ${risk.toLowerCase()}">

                            ${risk}

                        </span>

                    </td>

                    <td>
                        ${
                            reading.timestamp
                                ? formatAlertTime(
                                    reading.timestamp
                                )
                                : "--"
                        }
                    </td>

                </tr>

            `;

        }).join("");

}


// ==========================================
// FETCH AUDIT LOGS
// ==========================================

async function fetchAuditLogs() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/audit-logs`,
                {
                    headers: AUTH_HEADERS
                }
            );

        if (!response.ok) {

            throw new Error(
                "Audit logs API error"
            );

        }

        const logs =
            await response.json();

        updateAuditLogs(logs);

    }

    catch (error) {

        console.error(
            "Unable to load audit logs:",
            error
        );

    }

}


// ==========================================
// UPDATE AUDIT LOGS UI
// ==========================================

function updateAuditLogs(
    logs
) {

    const tableBody =
        document.getElementById(
            "auditTableBody"
        );

    if (!tableBody) {

        return;

    }

    if (
        !logs ||
        logs.length === 0
    ) {

        tableBody.innerHTML = `

            <tr>

                <td colspan="4">
                    No audit events available
                </td>

            </tr>

        `;

        return;

    }

    tableBody.innerHTML =
        logs.map(log => {

            return `

                <tr>

                    <td>
                        ${log.user_id ?? "--"}
                    </td>

                    <td>
                        ${log.action}
                    </td>

                    <td>
                        ${log.details ?? "--"}
                    </td>

                    <td>
                        ${
                            formatAlertTime(
                                log.timestamp
                            )
                        }
                    </td>

                </tr>

            `;

        }).join("");

}


// ==========================================
// ACKNOWLEDGE BUTTON
// ==========================================

document.addEventListener(
    "click",
    (event) => {

        const button =
            event.target.closest(
                ".acknowledge-btn"
            );

        if (!button) {

            return;

        }

        const alertId =
            button.dataset.alertId;

        resolveAlert(alertId);

    }
);


// ==========================================
// INITIAL LOAD
// ==========================================

fetchSensorData();

fetchAlerts();

fetchHistory();


// ==========================================
// AUTO REFRESH
// ==========================================

setInterval(
    fetchSensorData,
    2000
);

setInterval(
    fetchAlerts,
    3000
);

setInterval(
    fetchHistory,
    5000
);
// ==========================================
// ==========================================
// ROLE-BASED AUDIT LOG
// ==========================================

function setupRoleBasedUI() {

    const auditSection =
        document.getElementById("auditLogSection");

    if (!auditSection) {
        return;
    }

    const userData =
        sessionStorage.getItem("edgeguard_user");

    if (!userData) {
        return;
    }

    try {

        const user =
            JSON.parse(userData);

        console.log("Logged-in user:", user);

        if (user.role === "ADMIN") {

            auditSection.style.display = "";

            fetchAuditLogs();

        } else {

            auditSection.style.display = "none";

        }

    } catch (error) {

        console.error(
            "Role check failed:",
            error
        );

        auditSection.style.display = "none";
    }
}

setupRoleBasedUI();
// ==========================================
// AUTO REFRESH ALERTS
// ==========================================

setInterval(
    fetchAlerts,
    3000
);
async function controlDevice(device, command) {

    try {

        const response = await fetch(
            `${API_URL}/api/control/${device}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...AUTH_HEADERS
                },
                body: JSON.stringify({
                    command: command
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Control failed");
            return;
        }

        console.log(
            `Device control: ${device} -> ${command}`
        );

    } catch (error) {

        console.error(
            "Device control error:",
            error
        );

        alert("Unable to control device");
    }
}
