from typing import Optional
from pydantic import BaseModel, Field

class VehicleFilterParams(BaseModel):
    tipo_veiculo: str = Field(default="carro", description="carro, moto ou caminhao")
    preco_min: Optional[float] = Field(default=None, description="Preço mínimo em R$")
    preco_max: Optional[float] = Field(default=None, description="Preço máximo em R$")
    ano_min: Optional[int] = Field(default=None, description="Ano modelo mínimo")
    ano_max: Optional[int] = Field(default=None, description="Ano modelo máximo")
    marca: Optional[str] = Field(default=None, description="Nome da marca")
    marcas: Optional[str] = Field(default=None, description="Marcas separadas por vírgula")
    combustivel: Optional[str] = Field(default=None, description="Nome do combustível")
    motorizacao: Optional[str] = Field(default="todos", description="todos, turbo, aspirado")
    cambio: Optional[str] = Field(default="todos", description="todos, automatico, manual")
    litragem: Optional[str] = Field(default="todos", description="todos, 1.0, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0, 2.0+")
    search: Optional[str] = Field(default=None, description="Termo de pesquisa livre")
    ordenacao: str = Field(default="preco_desc", description="Ordenação dos resultados")
    page: int = Field(default=1, ge=1, le=1000, description="Número da página")
    limit: int = Field(default=24, ge=1, le=100, description="Itens por página")

class EngineSizeItem(BaseModel):
    litragem: str
    total_modelos: int

class FuelItem(BaseModel):
    nome: str
    sigla: str
    total_modelos: int

