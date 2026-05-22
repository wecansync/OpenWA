import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ShoppingBag, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { catalogApi, type Product, type CatalogInfo } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Catalog.css';

export function Catalog() {
  const { t } = useTranslation();
  useDocumentTitle(t('catalog.title'));

  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter((s) => s.status === 'ready');
  const [sessionId, setSessionId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sendChatId, setSendChatId] = useState('');
  const [sendCaption, setSendCaption] = useState('');
  const [sendResult, setSendResult] = useState<string | null>(null);

  const { data: catalogInfo, isLoading: loadingCatalog, error: catalogError } = useQuery({
    queryKey: ['catalog-info', sessionId],
    queryFn: () => catalogApi.getCatalog(sessionId),
    enabled: !!sessionId,
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['catalog-products', sessionId, page],
    queryFn: () => catalogApi.getProducts(sessionId, page),
    enabled: !!sessionId,
  });

  const sendProductMutation = useMutation({
    mutationFn: () => catalogApi.sendProduct(sessionId, sendChatId, selectedProduct!.id, sendCaption || undefined),
    onSuccess: () => setSendResult(t('catalog.sent')),
    onError: (err: Error) => setSendResult(err.message),
  });

  const sendCatalogMutation = useMutation({
    mutationFn: () => catalogApi.sendCatalog(sessionId, sendChatId, sendCaption || undefined),
    onSuccess: () => setSendResult(t('catalog.sent')),
    onError: (err: Error) => setSendResult(err.message),
  });

  const catalog = catalogInfo as CatalogInfo | null | undefined;
  const products: Product[] = productsData?.products ?? [];
  const hasMore: boolean = productsData?.hasMore ?? false;

  return (
    <div className="catalog-page">
      <PageHeader
        title={t('catalog.title')}
        actions={
          sessionId && (
            <button
              className="catalog-send-all-btn"
              onClick={() => { setSelectedProduct(null); setSendResult(null); }}
            >
              <Send size={14} />
              {t('catalog.sendCatalog')}
            </button>
          )
        }
      />

      <div className="catalog-session-bar">
        <select
          className="catalog-select"
          value={sessionId}
          onChange={(e) => { setSessionId(e.target.value); setPage(1); setSelectedProduct(null); }}
          disabled={loadingSessions}
        >
          <option value="">{t('catalog.selectSession')}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {sessionId && (
        <>
          {/* Catalog info header */}
          {loadingCatalog ? null : catalogError ? (
            <div className="catalog-notice">{t('catalog.businessOnly')}</div>
          ) : catalog ? (
            <div className="catalog-info-card">
              <ShoppingBag size={18} />
              <div>
                <div className="catalog-info-name">{(catalog as { name?: string }).name ?? t('catalog.unnamed')}</div>
                {(catalog as { description?: string }).description && (
                  <div className="catalog-info-desc">{(catalog as { description?: string }).description}</div>
                )}
              </div>
            </div>
          ) : null}

          <div className="catalog-layout">
            {/* Product grid */}
            <div className="catalog-products">
              {loadingProducts ? (
                <div className="catalog-loading"><span className="catalog-spinner" /></div>
              ) : products.length === 0 ? (
                <div className="catalog-empty">{t('catalog.noProducts')}</div>
              ) : (
                <>
                  <div className="catalog-grid">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        className={`catalog-product-card${selectedProduct?.id === p.id ? ' selected' : ''}`}
                        onClick={() => { setSelectedProduct(p); setSendResult(null); }}
                      >
                        {(p as { imageUrl?: string }).imageUrl ? (
                          <img src={(p as { imageUrl?: string }).imageUrl} alt={p.name} className="catalog-product-img" />
                        ) : (
                          <div className="catalog-product-img-placeholder"><ShoppingBag size={28} /></div>
                        )}
                        <div className="catalog-product-name">{p.name}</div>
                        {(p as { price?: string; currency?: string }).price && (
                          <div className="catalog-product-price">
                            {(p as { currency?: string }).currency} {(p as { price?: string }).price}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="catalog-pagination">
                    <button
                      className="catalog-page-btn"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="catalog-page-label">{t('catalog.page')} {page}</span>
                    <button
                      className="catalog-page-btn"
                      disabled={!hasMore}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Send panel */}
            <div className="catalog-send-panel">
              <h3 className="catalog-panel-title">
                {selectedProduct ? t('catalog.sendProduct') : t('catalog.sendCatalogTitle')}
              </h3>
              {selectedProduct && (
                <div className="catalog-selected-product">
                  <span className="catalog-selected-name">{selectedProduct.name}</span>
                  <button className="catalog-deselect" onClick={() => setSelectedProduct(null)}>×</button>
                </div>
              )}
              <input
                type="text"
                className="catalog-input"
                placeholder={t('catalog.chatIdPlaceholder')}
                value={sendChatId}
                onChange={(e) => setSendChatId(e.target.value)}
              />
              <input
                type="text"
                className="catalog-input"
                placeholder={t('catalog.captionPlaceholder')}
                value={sendCaption}
                onChange={(e) => setSendCaption(e.target.value)}
              />
              <button
                className="catalog-send-btn"
                disabled={!sendChatId.trim() || sendProductMutation.isPending || sendCatalogMutation.isPending}
                onClick={() => {
                  setSendResult(null);
                  if (selectedProduct) sendProductMutation.mutate();
                  else sendCatalogMutation.mutate();
                }}
              >
                <Send size={14} />
                {t('catalog.send')}
              </button>
              {sendResult && <div className="catalog-send-result">{sendResult}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
