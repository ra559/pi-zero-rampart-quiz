/*
 * Pi Zero Rampart Quiz with user registration and login.
 * Run from the project directory: rampart server.js
 */
var server = require("rampart-server");
var crypto = require("rampart-crypto");
var utils = rampart.utils;

var ROOT = process.scriptPath || utils.getcwd();
var HTML_DIR = ROOT + "/html";
var DATA_DIR = ROOT + "/data";
var USERS_FILE = DATA_DIR + "/users.json";
var SESSIONS_FILE = DATA_DIR + "/sessions.json";

if (!utils.exists(DATA_DIR)) utils.mkdir(DATA_DIR, true);

function readJson(file, fallback) {
    if (!utils.exists(file)) return fallback;
    try {
        return JSON.parse(utils.readFile({ file: file, returnString: true }));
    } catch (e) {
        return fallback;
    }
}

function writeJson(file, value) {
    utils.writeFile(file, JSON.stringify(value, null, 2));
}

function users() { return readJson(USERS_FILE, {}); }
function sessions() { return readJson(SESSIONS_FILE, {}); }

function randomSalt() {
    return crypto.sha256(String(Math.random()) + ":" + String(new Date().getTime()) + ":" + String(utils.rand()));
}

function passwordHash(password, salt) {
    /* Simple demonstration hash. Use Rampart Auth for a real deployment. */
    return crypto.sha256(salt + ":" + password);
}

function requestData(req) {
    return (req.postData && req.postData.content) || {};
}

function jsonError(message, status) {
    return { status: status || 400, json: { error: message } };
}

function bearerToken(req) {
    var header = req.headers && (req.headers.Authorization || req.headers.authorization);
    if (!header || header.indexOf("Bearer ") !== 0) return "";
    return header.substring(7);
}

function currentUser(req) {
    var token = bearerToken(req);
    if (!token) return null;
    var allSessions = sessions();
    var username = allSessions[token];
    if (!username) return null;
    var allUsers = users();
    if (!allUsers[username]) return null;
    return { username: username, token: token };
}

function register(req) {
    var data = requestData(req);
    var username = String(data.username || "").trim();
    var password = String(data.password || "");

    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username))
        return jsonError("Username must be 3–32 characters: letters, numbers, underscore, or hyphen.");
    if (password.length < 8)
        return jsonError("Password must contain at least 8 characters.");

    var allUsers = users();
    if (allUsers[username])
        return jsonError("That username already exists.", 409);

    var salt = randomSalt();
    allUsers[username] = {
        salt: salt,
        passwordHash: passwordHash(password, salt),
        createdAt: new Date().toISOString()
    };
    writeJson(USERS_FILE, allUsers);

    var token = crypto.sha256(username + ":" + String(new Date().getTime()) + ":" + randomSalt());
    var allSessions = sessions();
    allSessions[token] = username;
    writeJson(SESSIONS_FILE, allSessions);

    return { json: { token: token, user: { username: username } } };
}

function login(req) {
    var data = requestData(req);
    var username = String(data.username || "").trim();
    var password = String(data.password || "");
    var allUsers = users();
    var user = allUsers[username];

    if (!user || passwordHash(password, user.salt) !== user.passwordHash)
        return jsonError("Invalid username or password.", 401);

    var token = crypto.sha256(username + ":" + String(new Date().getTime()) + ":" + randomSalt());
    var allSessions = sessions();
    allSessions[token] = username;
    writeJson(SESSIONS_FILE, allSessions);

    return { json: { token: token, user: { username: username } } };
}

function me(req) {
    var user = currentUser(req);
    if (!user) return jsonError("Please sign in.", 401);
    return { json: { username: user.username } };
}

function logout(req) {
    var token = bearerToken(req);
    var allSessions = sessions();
    if (token && allSessions[token]) {
        delete allSessions[token];
        writeJson(SESSIONS_FILE, allSessions);
    }
    return { json: { ok: true } };
}

var questions = [
    { id: 1, question: "Which command prints the current working directory?",
      options: [{value:"A",label:"pwd"},{value:"B",label:"whoami"},{value:"C",label:"ls"},{value:"D",label:"cd"}],
      answer: "A", explanation: "`pwd` prints the path of the current working directory." },
    { id: 2, question: "Which command lists files, including hidden files?",
      options: [{value:"A",label:"ls -l"},{value:"B",label:"ls -a"},{value:"C",label:"show-files"},{value:"D",label:"dir -h"}],
      answer: "B", explanation: "`ls -a` includes names that begin with a dot." },
    { id: 3, question: "On Debian, which command refreshes the package index?",
      options: [{value:"A",label:"apt clean"},{value:"B",label:"apt remove"},{value:"C",label:"apt update"},{value:"D",label:"apt reboot"}],
      answer: "C", explanation: "`apt update` downloads current package metadata." },
    { id: 4, question: "Which directory commonly contains system configuration files?",
      options: [{value:"A",label:"/home"},{value:"B",label:"/tmp"},{value:"C",label:"/var"},{value:"D",label:"/etc"}],
      answer: "D", explanation: "`/etc` contains system-wide configuration files." },
    { id: 5, question: "Which command shows filesystem space usage in a readable format?",
      options: [{value:"A",label:"df -h"},{value:"B",label:"free -m"},{value:"C",label:"du -p"},{value:"D",label:"mount -r"}],
      answer: "A", explanation: "`df -h` reports filesystem space using human-readable units." },
    { id: 6, question: "Which command changes file permissions?",
      options: [{value:"A",label:"chown"},{value:"B",label:"chmod"},{value:"C",label:"passwd"},{value:"D",label:"umask -r"}],
      answer: "B", explanation: "`chmod` changes permission bits; `chown` changes ownership." },
    { id: 7, question: "Which command displays currently running processes in a snapshot?",
      options: [{value:"A",label:"pwd"},{value:"B",label:"touch"},{value:"C",label:"ps"},{value:"D",label:"mkdir"}],
      answer: "C", explanation: "`ps` displays process information at the time it is run." },
    { id: 8, question: "What does `sudo` commonly allow an authorized user to do?",
      options: [{value:"A",label:"Compress every file automatically"},{value:"B",label:"Change the computer's hostname only"},{value:"C",label:"Connect to Wi-Fi without credentials"},{value:"D",label:"Run a command with another user's privileges"}],
      answer: "D", explanation: "`sudo` runs a command with privileges permitted by its policy, commonly as root." }
];

function getQuestions(req) {
    if (!currentUser(req)) return jsonError("Please sign in.", 401);
    return { json: { questions: questions.map(function (q) {
        return { id: q.id, question: q.question, options: q.options };
    }) } };
}

function submitQuiz(req) {
    if (!currentUser(req)) return jsonError("Please sign in.", 401);
    var data = requestData(req);
    var answers = data.answers;
    if (!answers || typeof answers !== "object")
        return jsonError("Expected JSON with an answers object.");

    var score = 0;
    var results = questions.map(function (q) {
        var submitted = answers[String(q.id)] || "";
        var correct = submitted === q.answer;
        if (correct) score += 1;
        return { id: q.id, correct: correct, selected: submitted,
                 answer: q.answer, explanation: q.explanation };
    });

    return { json: { score: score, total: questions.length,
                     percentage: Math.round((score / questions.length) * 100),
                     results: results } };
}

var pid = server.start({
    bind: "0.0.0.0:8088",
    map: {
        "/api/register": register,
        "/api/login": login,
        "/api/me": me,
        "/api/logout": logout,
        "/api/questions": getQuestions,
        "/api/submit": submitQuiz,
        "/": HTML_DIR
    }
});

utils.printf("Pi Zero Quiz is running at http://0.0.0.0:8088/\\n");
