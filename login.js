document.querySelectorAll('[name="login_role"]').forEach(r=>r.addEventListener("change",()=>{location.assign("/login.php?role="+encodeURIComponent(r.value));}));
