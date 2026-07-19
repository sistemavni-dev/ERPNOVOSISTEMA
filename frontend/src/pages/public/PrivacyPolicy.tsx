import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/button"

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold tracking-tight mb-4 text-foreground">Política de Privacidade</h1>
          <p className="text-muted-foreground mb-8">Última atualização: 18 de Julho de 2026 (Versão 1.0)</p>

          <div className="space-y-6 text-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Coleta de Informações</h2>
              <p>
                Coletamos informações essenciais para a prestação dos nossos serviços, incluindo dados cadastrais da empresa (CNPJ, nome, e-mail) e dados de navegação. Adicionalmente, armazenamos os dados inseridos pelos usuários na plataforma (produtos, clientes, vendas) sob a condição de operadores de dados, conforme as diretrizes da LGPD (Lei 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. Uso dos Dados</h2>
              <p className="mb-2">
                Os dados coletados são utilizados exclusivamente para:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Fornecer, operar e manter nossa plataforma;</li>
                <li>Melhorar, personalizar e expandir nossos serviços;</li>
                <li>Compreender e analisar como você utiliza a plataforma;</li>
                <li>Processar transações e enviar notificações relacionadas (ex: relatórios, faturas).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Compartilhamento de Informações</h2>
              <p>
                Não vendemos, alugamos ou compartilhamos seus dados pessoais ou comerciais com terceiros, exceto quando estritamente necessário para o funcionamento da plataforma (como processadores de pagamento e provedores de infraestrutura cloud), ou mediante exigência legal.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Segurança dos Dados</h2>
              <p>
                Empregamos medidas de segurança técnicas e organizacionais adequadas (como criptografia e controle de acesso) para proteger seus dados contra acesso, alteração, divulgação ou destruição não autorizada. Contudo, nenhuma transmissão pela internet é 100% segura.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Seus Direitos (LGPD)</h2>
              <p>
                Você tem o direito de solicitar o acesso, correção, atualização ou exclusão de suas informações pessoais. Caso deseje exercer seus direitos, entre em contato conosco através dos canais de suporte da plataforma.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
