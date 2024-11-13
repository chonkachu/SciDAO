# SciDAO

Projeto para a disciplina SSC0958 - Criptomoedas e Blockchain (2024)

SciDAO é um DAO voltado ao financiamento científico descentralizado. Usuários podem adquirir tokens, submeter e votar em projetos.
Após um projeto adquirir no mínimo 100 tokens através do financiamento de usuários da plataforma, a fase de checagem da comunidade
iniciará. Nesta fase, composta por 10 rodadas, os tokens acumulados durante a fase de financiamento serão enviados à carteira do usuário que
propôs o projeto, em cada rodada será enviado 10% do total de tokens acumulados. Cada rodada dura no máximo 7 dias, se uma rodada não atingir
a condição de 50%+1 de votos dentro dessa janela de tempo, a rodada poderá ser reiniciada pelo usuário que propôs o projeto.

O endereço do contrato na rede Sepolia é 0x6722169CF3259678D79C95673B390d318d3f0E90

[Link do etherscan](https://sepolia.etherscan.io/address/0x6722169cf3259678d79c95673b390d318d3f0e90)

Passos para rodar o código: 

1. `git clone https://github.com/chonkachu/SciDAO.git`
2. `npm install`
3. `npm run dev`
