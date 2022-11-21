from bs4 import BeautifulSoup
import pandas as pd
import re
from tqdm import tqdm
from PyKomoran import *

tqdm.pandas()
komoran = Komoran("EXP")

def cleanText(readData):
    text = re.sub(r'[-=+,#/\?:^$.@*\"※~&%ㆍ!』\\‘|\(\)\[\]\<\>`\'…》\’\“\”\·\n\r\t■◇◆▶;\xa0]', '', readData).strip()
    return text

def morp(strings):
   return [w.get_first()+'다' if w.get_second() in ['VV','VA'] else w.get_first() for w in komoran.get_list(cleanText(strings)) if w.get_second() in ['NNP','NNG','MAG','VA','VV','MM']]

def parsing(df : pd.DataFrame) :
    titleL = []
    contentL = []
    for i in range(len(df)):
        soup = BeautifulSoup(df['data'][i], "lxml")
        title = soup.body.h3.text
        body = []
        ptags = soup.find('section').find_all('p')

        for v in ptags:
            body.append(v.get_text())
        body = ''.join(body) 

        titleL.append(title)
        contentL.append(body)
    return dict(title = titleL,
                content = contentL)

if __name__ == "__main__":
    df = pd.read_json('./user.json')

    titleL = []
    contentL = []

    for i in range(len(df)):
        soup = BeautifulSoup(df['data'][i], "lxml")
        title = soup.body.h3.text

        body = []
        ptags = soup.find('section').find_all('p')
        for v in ptags:
            body.append(v.get_text())
        body = ''.join(body) 

        titleL.append(title)
        contentL.append(body)

    resultDict = dict(title = titleL,
                    content = contentL)

    pdf = pd.DataFrame(resultDict)
    pdf = pdf.dropna(subset=['title'])
    pdf = pdf.dropna(subset=['content'])
    pdf['contents'] = pdf.apply(lambda x:x['title'] + "\n" + x['content'], axis=1)
    pdf['all_tokens'] = pdf['contents'].progress_map(lambda x : komoran.get_morphes_by_tags(cleanText(x)))

    with open('./model/stopwords/stopwords.txt') as f:
        stopwordsList = f.read().splitlines()
    stopwordsSet = set(stopwordsList)
    pdf['all_tokens'] = pdf['all_tokens'].map(lambda x:[w for w in x if not w in stopwordsSet])

