import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/button"

export default function TermsOfUse() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold tracking-tight mb-4 text-foreground">Termos de Uso</h1>
          <p className="text-muted-foreground mb-8">Última atualização: 18 de Julho de 2026 (Versão 1.0)</p>

          <div className="space-y-6 text-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar a plataforma VniERP, você concorda em cumprir e ser regido por estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. Uso da Plataforma</h2>
              <p>
                A plataforma VniERP é um sistema SaaS de gestão comercial (ERP) voltado para controle de estoque, PDV, financeiro e integração com clientes. Você concorda em utilizar a plataforma apenas para fins lícitos e de acordo com as leis aplicáveis, incluindo a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Responsabilidade pelos Dados</h2>
              <p>
                O Lojista (contratante) é o único responsável pelos dados inseridos na plataforma, incluindo dados de seus próprios clientes. O VniERP atua apenas como operador dos dados, processando-os conforme as configurações definidas por você.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Planos e Pagamentos</h2>
              <p>
                O uso contínuo da plataforma está sujeito ao pagamento da mensalidade referente ao plano escolhido (Bronze, Prata, Ouro). A falta de pagamento poderá acarretar a suspensão temporária do acesso.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Modificações dos Termos</h2>
              <p>
                Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. Modificações significativas serão notificadas aos usuários, e será exigido um novo aceite para continuar utilizando a plataforma.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
