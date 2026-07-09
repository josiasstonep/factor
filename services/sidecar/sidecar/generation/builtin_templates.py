"""
Builtin skeleton templates for common expertise types.
Each template is returned as a confirmed Template object ready for DOCX generation.
"""
from datetime import datetime, timezone
from uuid import uuid4

from sidecar.models.template import (
    ImagePlaceholderType,
    SectionType,
    Template,
    TemplateImagePlaceholder,
    TemplateSection,
    TemplateVariable,
)

_BUILTIN_EXPERTISE_TYPES: dict[str, str] = {
    "informatica_extracao_completa": "Informática — Extração Completa (celular)",
    "informatica_extracao": "Informática — Extração Simples (celular)",
    "informatica_multiplos": "Informática — Múltiplos Dispositivos",
    "homicidio": "Homicídio — Local do Crime",
    "transito": "Acidente de Trânsito",
}


def list_builtin_types() -> list[dict[str, str]]:
    return [{"key": k, "label": v} for k, v in _BUILTIN_EXPERTISE_TYPES.items()]


def _var(key: str, label: str, value_type: str = "text", source_value: str | None = None) -> TemplateVariable:
    return TemplateVariable(
        id=str(uuid4()),
        key=key,
        label=label,
        value_type=value_type,  # type: ignore[arg-type]
        source_value_detected=source_value,
    )


def _section(label: str, order: int, section_type: SectionType, default_text: str = "") -> TemplateSection:
    return TemplateSection(
        id=str(uuid4()),
        type=section_type,
        label=label,
        order=order,
        is_ai_improvable=True,
        default_text=default_text or None,
    )


def _image(label: str, order: int, section_id: str, img_type: ImagePlaceholderType = ImagePlaceholderType.CUSTOM) -> TemplateImagePlaceholder:
    return TemplateImagePlaceholder(
        id=str(uuid4()),
        type=img_type,
        label=label,
        order=order,
        max_count=1,
        section_id=section_id,
    )


def _common_vars() -> list[TemplateVariable]:
    return [
        _var("rep", "Número da REP"),
        _var("numero_laudo", "Número do Laudo"),
        _var("data_laudo", "Data do Laudo", value_type="date"),
        _var("nome_perito", "Nome do Perito"),
        _var("matricula_perito", "Matrícula do Perito"),
        _var("delegacia_requisitante", "Delegacia Requisitante"),
        _var("trecho_solicitacao", "Trecho da Solicitação"),
    ]


def _informatica_extracao_completa() -> tuple[list[TemplateSection], list[TemplateVariable], list[TemplateImagePlaceholder]]:
    s_hist = _section("Histórico", 0, SectionType.HISTORIA,
        "Trata-se de exame pericial em dispositivo eletrônico, solicitado pela {{delegacia_requisitante}}, "
        "conforme {{trecho_solicitacao}}.")
    s_desc = _section("Descrição do Material", 1, SectionType.DESCRICAO,
        "Foram recebidos para exame os seguintes materiais:\n"
        "· Vestígio 01 — {{modelo}}, IMEI 1: {{imei1}}, IMEI 2: {{imei2}}.")
    s_anal = _section("Análise Forense dos Dados Extraídos", 2, SectionType.ANALISE,
        "Procedeu-se à extração forense dos dados contidos no dispositivo utilizando ferramenta homologada. "
        "Os dados extraídos foram analisados em busca de elementos relevantes ao caso.")
    s_integ = _section("Verificação de Integridade dos Arquivos", 3, SectionType.CUSTOM,
        "Foram calculados os hashes (MD5/SHA-256) dos arquivos de extração para garantir a integridade dos dados, "
        "conforme boas práticas de cadeia de custódia.")
    s_conc = _section("Conclusão", 4, SectionType.CONCLUSAO,
        "Com base nas análises realizadas, conclui-se que [inserir conclusão pericial].\n\n{{nome_perito}} Perito Criminal Mat. {{matricula_perito}}")

    sections = [s_hist, s_desc, s_anal, s_integ, s_conc]
    variables = _common_vars() + [
        _var("modelo", "Modelo do Dispositivo"),
        _var("imei1", "IMEI 1"),
        _var("imei2", "IMEI 2"),
    ]
    images = [
        _image("Figura 01 — Vestígio examinado", 0, s_desc.id, ImagePlaceholderType.VESTIGIO),
        _image("Figura 02 — Dados extraídos", 1, s_anal.id),
        _image("Figura 03 — Hash de integridade", 2, s_integ.id),
    ]
    return sections, variables, images


def _informatica_extracao() -> tuple[list[TemplateSection], list[TemplateVariable], list[TemplateImagePlaceholder]]:
    s_hist = _section("Histórico", 0, SectionType.HISTORIA,
        "Trata-se de exame pericial em dispositivo eletrônico, solicitado pela {{delegacia_requisitante}}, "
        "conforme {{trecho_solicitacao}}.")
    s_desc = _section("Descrição do Material", 1, SectionType.DESCRICAO,
        "Foram recebidos para exame os seguintes materiais:\n"
        "· Vestígio 01 — {{modelo}}, IMEI 1: {{imei1}}, IMEI 2: {{imei2}}.")
    s_anal = _section("Análise Forense dos Dados Extraídos", 2, SectionType.ANALISE,
        "Procedeu-se à extração forense dos dados contidos no dispositivo utilizando ferramenta homologada. "
        "Os dados extraídos foram analisados em busca de elementos relevantes ao caso.")
    s_conc = _section("Conclusão", 3, SectionType.CONCLUSAO,
        "Com base nas análises realizadas, conclui-se que [inserir conclusão pericial].\n\n{{nome_perito}} Perito Criminal Mat. {{matricula_perito}}")

    sections = [s_hist, s_desc, s_anal, s_conc]
    variables = _common_vars() + [
        _var("modelo", "Modelo do Dispositivo"),
        _var("imei1", "IMEI 1"),
        _var("imei2", "IMEI 2"),
    ]
    images = [
        _image("Figura 01 — Vestígio examinado", 0, s_desc.id, ImagePlaceholderType.VESTIGIO),
        _image("Figura 02 — Dados extraídos", 1, s_anal.id),
    ]
    return sections, variables, images


def _informatica_multiplos() -> tuple[list[TemplateSection], list[TemplateVariable], list[TemplateImagePlaceholder]]:
    s_hist = _section("Histórico", 0, SectionType.HISTORIA,
        "Trata-se de exame pericial em múltiplos dispositivos eletrônicos, solicitado pela {{delegacia_requisitante}}, "
        "conforme {{trecho_solicitacao}}.")
    s_desc = _section("Descrição dos Materiais", 1, SectionType.DESCRICAO,
        "Foram recebidos para exame os seguintes materiais:\n"
        "· Vestígio 01 — {{modelo_1}}, IMEI 1: {{imei1_1}}, IMEI 2: {{imei2_1}}.\n"
        "· Vestígio 02 — {{modelo_2}}, IMEI 1: {{imei1_2}}, IMEI 2: {{imei2_2}}.")
    s_anal = _section("Análise Forense dos Dados Extraídos", 2, SectionType.ANALISE,
        "Procedeu-se à extração forense dos dados contidos nos dispositivos utilizando ferramenta homologada. "
        "Os dados extraídos foram analisados em busca de elementos relevantes ao caso.")
    s_integ = _section("Verificação de Integridade dos Arquivos", 3, SectionType.CUSTOM,
        "Foram calculados os hashes (MD5/SHA-256) dos arquivos de extração para garantir a integridade dos dados.")
    s_conc = _section("Conclusão", 4, SectionType.CONCLUSAO,
        "Com base nas análises realizadas, conclui-se que [inserir conclusão pericial].\n\n{{nome_perito}} Perito Criminal Mat. {{matricula_perito}}")

    sections = [s_hist, s_desc, s_anal, s_integ, s_conc]
    variables = _common_vars() + [
        _var("modelo_1", "Modelo Dispositivo 1"),
        _var("imei1_1", "IMEI 1 (Disp. 1)"),
        _var("imei2_1", "IMEI 2 (Disp. 1)"),
        _var("modelo_2", "Modelo Dispositivo 2"),
        _var("imei1_2", "IMEI 1 (Disp. 2)"),
        _var("imei2_2", "IMEI 2 (Disp. 2)"),
    ]
    images = [
        _image("Figura 01 — Vestígio 01", 0, s_desc.id, ImagePlaceholderType.VESTIGIO),
        _image("Figura 02 — Vestígio 02", 1, s_desc.id, ImagePlaceholderType.VESTIGIO),
        _image("Figura 03 — Dados extraídos", 2, s_anal.id),
    ]
    return sections, variables, images


def _homicidio() -> tuple[list[TemplateSection], list[TemplateVariable], list[TemplateImagePlaceholder]]:
    s_hist = _section("Histórico", 0, SectionType.HISTORIA,
        "Trata-se de exame pericial em local de crime contra a vida, solicitado pela {{delegacia_requisitante}}, "
        "conforme {{trecho_solicitacao}}.")
    s_local = _section("Descrição do Local do Crime", 1, SectionType.DESCRICAO,
        "O local foi encontrado [descrever características do ambiente, acesso, condições de preservação].")
    s_vest = _section("Vestígios Examinados", 2, SectionType.CUSTOM,
        "Foram localizados e coletados os seguintes vestígios:\n"
        "· Vestígio 01 — [descrever vestígio].")
    s_anal = _section("Análise", 3, SectionType.ANALISE,
        "A análise dos vestígios e do local permitiu concluir que [inserir análise das evidências].")
    s_conc = _section("Conclusão", 4, SectionType.CONCLUSAO,
        "Com base nos exames realizados, conclui-se que [inserir conclusão pericial].")

    sections = [s_hist, s_local, s_vest, s_anal, s_conc]
    variables = [
        _var("rep", "Número da REP"),
        _var("numero_laudo", "Número do Laudo"),
        _var("data_laudo", "Data do Laudo", value_type="date"),
        _var("nome_perito", "Nome do Perito"),
        _var("delegacia_requisitante", "Delegacia Requisitante"),
        _var("trecho_solicitacao", "Trecho da Solicitação"),
        _var("endereco_local", "Endereço do Local"),
        _var("municipio", "Município"),
    ]
    images = [
        _image("Figura 01 — Vista geral do local", 0, s_local.id, ImagePlaceholderType.LOCAL_CRIME),
        _image("Figura 02 — Vestígio 01", 1, s_vest.id, ImagePlaceholderType.VESTIGIO),
        _image("Figura 03 — Detalhe do vestígio", 2, s_vest.id, ImagePlaceholderType.VESTIGIO),
    ]
    return sections, variables, images


def _transito() -> tuple[list[TemplateSection], list[TemplateVariable], list[TemplateImagePlaceholder]]:
    s_hist = _section("Histórico", 0, SectionType.HISTORIA,
        "Trata-se de exame pericial em veículo(s) envolvido(s) em acidente de trânsito, solicitado pela "
        "{{delegacia_requisitante}}, conforme {{trecho_solicitacao}}.")
    s_veiculo = _section("Descrição dos Veículos", 1, SectionType.DESCRICAO,
        "Foram examinados os seguintes veículos:\n"
        "· Veículo 01 — {{modelo_veiculo}}, Placa: {{placa}}, Cor: {{cor}}.")
    s_anal = _section("Análise das Avarias", 2, SectionType.ANALISE,
        "A análise das avarias presentes nos veículos permitiu [descrever características das avarias e "
        "compatibilidade com as informações do acidente].")
    s_conc = _section("Conclusão", 3, SectionType.CONCLUSAO,
        "Com base nos exames realizados, conclui-se que [inserir conclusão pericial].")

    sections = [s_hist, s_veiculo, s_anal, s_conc]
    variables = [
        _var("rep", "Número da REP"),
        _var("numero_laudo", "Número do Laudo"),
        _var("data_laudo", "Data do Laudo", value_type="date"),
        _var("nome_perito", "Nome do Perito"),
        _var("delegacia_requisitante", "Delegacia Requisitante"),
        _var("trecho_solicitacao", "Trecho da Solicitação"),
        _var("modelo_veiculo", "Modelo do Veículo"),
        _var("placa", "Placa"),
        _var("cor", "Cor do Veículo"),
    ]
    images = [
        _image("Figura 01 — Vista frontal do veículo", 0, s_veiculo.id, ImagePlaceholderType.VESTIGIO),
        _image("Figura 02 — Avarias (detalhe)", 1, s_anal.id, ImagePlaceholderType.VESTIGIO),
    ]
    return sections, variables, images


_BUILDERS = {
    "informatica_extracao_completa": _informatica_extracao_completa,
    "informatica_extracao": _informatica_extracao,
    "informatica_multiplos": _informatica_multiplos,
    "homicidio": _homicidio,
    "transito": _transito,
}


def get_builtin_template(expertise_type: str) -> Template:
    if expertise_type not in _BUILDERS:
        raise ValueError(f"Tipo desconhecido: {expertise_type!r}. Disponíveis: {list(_BUILDERS)}")

    sections, variables, images = _BUILDERS[expertise_type]()
    label = _BUILTIN_EXPERTISE_TYPES[expertise_type]

    return Template(
        id=str(uuid4()),
        name=label,
        created_at=datetime.now(timezone.utc),
        source_pdf_filename="(template interno)",
        status="draft_parsed",
        sections=sections,
        variables=variables,
        image_placeholders=images,
        expertise_type=expertise_type,
    )
