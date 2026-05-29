from pydantic import BaseModel, ConfigDict
from fastapi.encoders import jsonable_encoder

class Row(BaseModel):
    model_config = ConfigDict(extra="allow")
    x: int = 1

r = Row(x=2, y=3)
print("r:", r)
print("model_dump:", r.model_dump())
print("jsonable_encoder:", jsonable_encoder(r))
