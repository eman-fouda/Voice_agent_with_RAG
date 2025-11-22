import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import CrossEncoder

PDF_PATH = "hr_faq_policies.pdf"
INDEX_PATH = "faiss.index"
DOCS_PATH = "docs.pkl"
CHUNK_SIZE = 600
CHUNK_OVERLAP = 100


splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP, separators=["\n\n", "\n", " ", ""])
embeddings = HuggingFaceEmbeddings(model_name='all-MiniLM-L6-v2',encode_kwargs={"normalize_embeddings": True})

def load_pdf(PDF_PATH):
    """Load PDF and split into chunks"""
    loader = PyPDFLoader(file_path=PDF_PATH)
    documents = loader.load()
    split_docs = splitter.split_documents(documents)
    return split_docs

def build_embeddings():
    """Generate embeddings for document chunks"""
    chunks = load_pdf(PDF_PATH) 
    print("Chunks:", len(chunks))
    print("Sample chunk:", chunks[0].page_content[:200])
    vectorstore = FAISS.from_documents(chunks, embeddings)
    vectorstore.save_local(INDEX_PATH)
    print("FAISS index saved!")

vectorstore = None

def init_vectorstore():
    global vectorstore
    if vectorstore is None:
        vectorstore = FAISS.load_local(
            INDEX_PATH, embeddings, allow_dangerous_deserialization=True
        )

    return vectorstore

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L6-v2")

def retrieve_top_k(query, k=3):
    """Retrieve top-k FAISS search results with reranking"""
    vs = init_vectorstore()
    query_embedding = embeddings.embed_query(query)
    results = vs.similarity_search_by_vector(query_embedding, k=30)
    if not results:
        return []
    
    pairs = [[query, c.page_content] for c in results]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(results, scores), key=lambda x: x[1], reverse=True)
    top_k = [doc for doc, score in ranked[:k]]
    return top_k