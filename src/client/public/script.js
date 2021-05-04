// web-socket stuff
const socket = new WebSocket("ws://localhost:8080");

socket.onopen = () => {
  console.info("[socket] Connection established");
};

socket.onclose = (event) => {
  if (event.wasClean) {
    console.info(
      `[socket] Connection closed cleanly, code=${event.code} reason=${event.reason}`
    );
  } else {
    // e.g. server process killed or network down
    // event.code is usually 1006 in this case
    console.warn("[socket] Connection died");
  }
};

socket.onerror = (error) => {
  console.error(`[socket] ${error}`);
};

socket.onmessage = (event) => {
  const data = event.data;
  if (data === "succ") {
    const container = document.getElementById("msg");
    const alert = document.createElement("div");
    alert.classList.add("aler");
    alert.classList.add("alert-primary");
    const text = document.createTextNode("Download Complete");
    alert.appendChild(text);
    container.appendChild(alert);
  }
};

// Handle upload
const handleUpload = () => {
  const input = document.getElementById("fileinput");
  const file = input.files[0];

  const fd = new FormData();
  fd.append("inputfile", file);

  fetch("http://localhost:3000/upload", {
    method: "POST",
    body: fd,
  })
    .then(
      (success) => console.log(success) // Handle the success response object
    )
    .catch(
      (error) => console.log(error) // Handle the error response object
    );
};

// Handle download
const handleDownload = () => {
  const filename = document.getElementById("filesearch").value;
  socket.send(`download ${filename}`);
};
