const handleUpload = () => {
  const input = document.getElementById("fileinput");
  const file = input.files[0];
  console.log(file);

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
