"""Service layer: business logic lives here, not in routes (doc 14).

Routes parse HTTP and call services; services coordinate models. This keeps
routes thin and the business rules testable in isolation.
"""
