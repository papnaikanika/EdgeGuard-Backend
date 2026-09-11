const loginForm =
    document.getElementById("loginForm");

const loginError =
    document.getElementById("loginError");


loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        loginError.textContent = "";

        const username =
            document.getElementById(
                "username"
            ).value.trim();

        const password =
            document.getElementById(
                "password"
            ).value;


        try {

            const response =
                await fetch(
                    "/api/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                loginError.textContent =
                    data.error ||
                    "Login failed";

                return;

            }


            sessionStorage.setItem(
                "edgeguard_token",
                data.token
            );

            sessionStorage.setItem(
                "edgeguard_user",
                JSON.stringify(
                    data.user
                )
            );


            window.location.href =
                "/dashboard";

        }

        catch (error) {

            console.error(
                "Login error:",
                error
            );

            loginError.textContent =
                "Unable to connect to server";

        }

    }
);
