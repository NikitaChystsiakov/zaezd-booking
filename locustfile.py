from locust import HttpUser, task, between


class WebSofaUser(HttpUser):
    """
    Один тип пользователя:
    - ходит по публичным страницам
    - иногда делает POST на авторизацию реальным пользователем
    """

    # Пауза между действиями виртуального пользователя
    wait_time = between(1, 3)

    @task(5)
    def open_home(self):
        self.client.get("/", name="GET /")

    @task(4)
    def open_products(self):
        self.client.get("/products", name="GET /products")

    @task(2)
    def load_products_api(self):
        self.client.get("/api/v1/products", name="GET /api/v1/products")

    @task(1)
    def open_cart(self):
        self.client.get("/cart", name="GET /cart")

    @task(1)
    def open_about(self):
        self.client.get("/about", name="GET /about")

    @task(1)
    def open_login(self):
        self.client.get("/login", name="GET /login")

    @task(1)
    def login(self):
        payload = {
            "email": "vlad@gmail.com",
            "phone": "+375291809530",
            "password": "11111111",
        }
        self.client.post(
            "/api/v1/auth/login",
            json=payload,
            name="POST /api/v1/auth/login (vlad)",
        )

