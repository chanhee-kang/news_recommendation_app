from fastapi import FastAPI
from pydantic import BaseModel


class CalParam(BaseModel):
    a: int
    b: int
    cal_type: str


app = FastAPI()


@app.get('/')
def read_root():
    return {
        'result': 'This is a FastAPI server'
    }


@app.post('/calculator/')
def calculate(param: CalParam):
    if param.cal_type == 'addition':
        value = param.a + param.b
    elif param.cal_type == 'subtraction':
        value = param.a - param.b
    elif param.cal_type == 'multiplication':
        value = param.a * param.b
    elif param.cal_type == 'division':
        value = param.a / param.b
    else:
        return {
            'error': 'cal_type must be one of "addition", "subtraction", "multiplication, or "division".'}
    return {'result': value}